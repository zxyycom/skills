import { runArchiveTests } from "./archive.test.ts";
import { runCatalogTests } from "./catalog.test.ts";
import { runCheckTests } from "./check.test.ts";
import { runCliTests } from "./cli.test.ts";
import {
  runGeneratedArtifactTests
} from "./generated-artifacts.test.ts";

await runCheckTests();
await runCatalogTests();
await runArchiveTests();
await runCliTests();
await runGeneratedArtifactTests();

console.log("Change plan CLI tests passed.");
