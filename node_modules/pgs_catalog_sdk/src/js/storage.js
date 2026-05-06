import localforage from "localforage";

export async function estimateLocalForageSizeKB() {
  let total = 0;

  await localforage.iterate((value, key) => {
    const size = new Blob([JSON.stringify(value)]).size;
    total += size;
  });

  const totalKB = total / 1024;
  console.log("LocalForage size:", totalKB.toFixed(2), "KB");
  return totalKB;
}

export async function checkStorageKB() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    const usageKB = usage / 1024;
    const quotaKB = quota / 1024;

    console.log("Used:", usageKB.toFixed(2), "KB");
    console.log("Quota:", quotaKB.toFixed(2), "KB");
    console.log("Percent used:", ((usageKB / quotaKB) * 100).toFixed(2) + "%");

    return { usage, quota, usageKB, quotaKB };
  } else {
    console.log("Storage API not supported");
  }
}

export function getTextSizeKB(text) {
  try {
    const textValue = typeof text === "string" ? text : JSON.stringify(text);
    const sizeBytes = new Blob([textValue ?? ""]).size;
    const sizeKB = sizeBytes / 1024;
    console.log(`Size: ${sizeBytes} bytes (${sizeKB.toFixed(2)} KB)`);
    return sizeKB;
  } catch (error) {
    const message = error?.message ?? String(error);
    console.error(`getTextSizeKB() failed: ${message}`);
    throw new Error(`Unable to calculate text size: ${message}`);
  }
}