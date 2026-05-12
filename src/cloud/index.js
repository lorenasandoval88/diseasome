import { Storage } from "@google-cloud/storage";

import {
  fetchAllScores,
  getTxts,
  fetchAvailableDataTypes,
  allUsersMetaDataByType_fast,
  fetchProfile,
  load23andMeFile,
  Match2
} from "./cloud_sdk.mjs";

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME);

const USER_LIMIT = Number(process.env.USER_LIMIT || process.env.LIMIT || 3);
const PGS_LIMIT = Number(process.env.PGS_LIMIT || 3);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 1);

const BASE_PATH = "prs_workflow";

async function saveJson(path, obj) {
  await bucket.file(path).save(JSON.stringify(obj, null, 2), {
    contentType: "application/json"
  });
}

async function saveText(path, text) {
  await bucket.file(path).save(text, {
    contentType: "text/plain"
  });
}

async function fileExists(path) {
  const [exists] = await bucket.file(path).exists();
  return exists;
}

function normalizeLoaded23andMe(loaded) {
  if (!loaded) return { raw: null, parsed: null };

  if (typeof loaded === "string") {
    return {
      raw: loaded,
      parsed: null
    };
  }

  return {
    raw: loaded.txt ?? loaded.raw ?? null,
    parsed: loaded.dt ? loaded : loaded.parsed ?? loaded
  };
}

function normalizePGSTxt(pgsObj) {
  if (!pgsObj) return null;

  if (typeof pgsObj === "string") {
    return pgsObj;
  }

  return pgsObj;
}

async function runInBatches(items, batchSize, fn) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    console.log(`Starting batch ${i / batchSize + 1}`);

    const batchResults = await Promise.all(
      batch.map((item, j) => fn(item, i + j, items.length))
    );

    results.push(...batchResults);

    console.log(`Finished ${results.length}/${items.length}`);
  }

  return results;
}

async function loadOneUser(user, index, total) {
  const id = user.id;

  try {
    console.log(`Loading user ${index + 1}/${total}: ${id}`);

    const profilePath = `${BASE_PATH}/pgp/profiles/${id}.json`;
    const parsedPath = `${BASE_PATH}/pgp/parsed_23andme/${id}.json`;
    const rawPath = `${BASE_PATH}/pgp/raw_txt/${id}.txt`;
    const metadataPath = `${BASE_PATH}/pgp/metadata/${id}.json`;

    const [profile, loaded23] = await Promise.all([
      fetchProfile(id),
      load23andMeFile(user.downloadUrl, id, false)
    ]);

    const { raw, parsed } = normalizeLoaded23andMe(loaded23);

    await saveJson(profilePath, profile);
    await saveJson(metadataPath, user);

    if (raw) {
      await saveText(rawPath, raw);
    }

    await saveJson(parsedPath, parsed ?? loaded23);

    console.log(`Saved user ${id}`);

    return {
      id,
      user,
      profile,
      genotype: parsed ?? loaded23,
      status: "success"
    };

  } catch (err) {
    console.error(`Failed user ${id}: ${err.message}`);

    await saveJson(`${BASE_PATH}/errors/users/${id}.json`, {
      id,
      user,
      error: err.message,
      failedAt: new Date().toISOString()
    });

    return {
      id,
      user,
      profile: null,
      genotype: null,
      status: "failed",
      error: err.message
    };
  }
}

async function loadPgsModels() {
  console.log("Fetching PGS Catalog score metadata...");

  const allScoresResult = await fetchAllScores();

  const scores = Array.isArray(allScoresResult)
    ? allScoresResult
    : allScoresResult.scores ?? allScoresResult.results ?? [];

  console.log(`Found ${scores.length} PGS models.`);

  await saveJson(`${BASE_PATH}/manifests/all_pgs_scores_metadata.json`, scores);

  const selectedScores = scores.slice(0, PGS_LIMIT);
  const selectedIds = selectedScores.map(s => s.id);

  console.log(`Fetching first ${selectedIds.length} PGS scoring files: ${selectedIds.join(", ")}`);

  const txts = await getTxts(selectedIds);

  await saveJson(`${BASE_PATH}/manifests/selected_pgs_models.json`, selectedScores);

  const models = selectedIds.map((id, i) => {
    let txtObj;

    if (Array.isArray(txts)) {
      txtObj = txts.find(x => x?.id === id) ?? txts[i];
    } else {
      txtObj = txts[id] ?? txts[i];
    }

    return {
      id,
      meta: selectedScores[i],
      txt: normalizePGSTxt(txtObj)
    };
  });

  for (const model of models) {
    await saveJson(`${BASE_PATH}/pgs/metadata/${model.id}.json`, model.meta);
    await saveJson(`${BASE_PATH}/pgs/txt/${model.id}.json`, model.txt);
  }

  return models;
}

async function runPrsForPair({ userObj, pgsObj }) {
  const userId = userObj.id;
  const pgsId = pgsObj.id;

  const resultPath = `${BASE_PATH}/prs_results/${userId}/${pgsId}.json`;

  try {
    if (await fileExists(resultPath)) {
      console.log(`Skipping existing PRS result: ${userId} × ${pgsId}`);
      return {
        userId,
        pgsId,
        status: "skipped"
      };
    }

    console.log(`Running PRS: ${userId} × ${pgsId}`);

    const result = await Match2(pgsObj.txt, userObj.genotype);

    await saveJson(resultPath, {
      userId,
      pgsId,
      pgsName: pgsObj.meta?.name ?? null,
      trait: pgsObj.meta?.trait_reported ?? null,
      result
    });

    return {
      userId,
      pgsId,
      status: "success"
    };

  } catch (err) {
    console.error(`Failed PRS ${userId} × ${pgsId}: ${err.message}`);

    await saveJson(`${BASE_PATH}/errors/prs/${userId}_${pgsId}.json`, {
      userId,
      pgsId,
      error: err.message,
      failedAt: new Date().toISOString()
    });

    return {
      userId,
      pgsId,
      status: "failed",
      error: err.message
    };
  }
}

async function main() {
  console.log("Starting PRS Cloud Run workflow...");

  if (!process.env.BUCKET_NAME) {
    throw new Error("Missing required environment variable: BUCKET_NAME");
  }

  console.log("Checking available PGP data types...");
  const dataTypes = await fetchAvailableDataTypes();
  await saveJson(`${BASE_PATH}/manifests/available_data_types.json`, dataTypes);

  console.log("Fetching 23andMe user metadata...");
  let users = await allUsersMetaDataByType_fast("23andMe");

  console.log(`Found ${users.length} 23andMe users.`);

  await saveJson(`${BASE_PATH}/manifests/all_23andme_metadata.json`, users);

  if (USER_LIMIT > 0) {
    users = users.slice(0, USER_LIMIT);
    console.log(`USER_LIMIT=${USER_LIMIT}; processing first ${users.length} users.`);
  }

  const loadedUsers = await runInBatches(users, BATCH_SIZE, loadOneUser);
  const validUsers = loadedUsers.filter(u => u.status === "success" && u.genotype);

  console.log(`Loaded ${validUsers.length}/${users.length} users successfully.`);

  const pgsModels = await loadPgsModels();

  const pairs = [];

  for (const userObj of validUsers) {
    for (const pgsObj of pgsModels) {
      pairs.push({ userObj, pgsObj });
    }
  }

  console.log(`Running ${pairs.length} PRS comparisons.`);

  const prsResults = await runInBatches(
    pairs,
    BATCH_SIZE,
    async pair => runPrsForPair(pair)
  );

  await saveJson(`${BASE_PATH}/manifests/import_and_prs_results.json`, {
    userLimit: USER_LIMIT,
    pgsLimit: PGS_LIMIT,
    totalUsersRequested: users.length,
    totalUsersLoaded: validUsers.length,
    totalPgsModels: pgsModels.length,
    totalPrsRuns: prsResults.length,
    success: prsResults.filter(r => r.status === "success").length,
    skipped: prsResults.filter(r => r.status === "skipped").length,
    failed: prsResults.filter(r => r.status === "failed").length,
    prsResults,
    completedAt: new Date().toISOString()
  });

  console.log("PRS Cloud Run workflow complete.");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});