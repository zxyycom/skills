import { runCliAndGeneratedArtifactTests } from "./cli-generated.test.ts";
import { runIndexAndQueryTests } from "./index-query.test.ts";
import { runParsingAndDirectoryTests } from "./parsing-directory.test.ts";
import { runScaleEvidenceTests } from "./scale.test.ts";

await runParsingAndDirectoryTests();
await runIndexAndQueryTests();
await runCliAndGeneratedArtifactTests();
await runScaleEvidenceTests();

console.log("Investigation report checker tests passed.");
