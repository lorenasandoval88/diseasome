// test-cloud-sdk.mjs - Quick validation that cloud_sdk.mjs is Node-safe and functional
import {
  fetchAvailableDataTypes,
  allUsersMetaDataByType_fast,
  fetchProfile,
  load23andMeFile,
  parse23Txt,
} from "./dist/cloud_sdk.mjs";

console.log("✓ cloud_sdk.mjs imported successfully (Node-safe)");
console.log("\nExported functions:");
console.log("  - fetchAvailableDataTypes:", typeof fetchAvailableDataTypes);
console.log("  - allUsersMetaDataByType_fast:", typeof allUsersMetaDataByType_fast);
console.log("  - fetchProfile:", typeof fetchProfile);
console.log("  - load23andMeFile:", typeof load23andMeFile);
console.log("  - parse23Txt:", typeof parse23Txt);

// Test parse23andMe function with sample data
const sample23andMe = `# This is a comment
# More metadata
rsid	chromosome	position	genotype
rs123	1	1000	AA
rs456	1	2000	AG
rs789	2	3000	GG`;

async function testParse() {
  console.log("\n✓ Testing parse23Txt with sample data...");
  const result = await parse23Txt(sample23andMe);
  console.log(`  Parsed ${result.variantCount} variants`);
  console.log('  Sample variant:', result.variants[0]);
}

testParse().catch(console.error);
