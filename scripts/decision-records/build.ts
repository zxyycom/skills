import path from "node:path";
import {
  addGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedFile
} from "../lib/generated-file.ts";
import { githubRepository, rootDir, toPosix } from "../lib/project.ts";

const sourceRelativePath = "scripts/decision-records/src/cli.ts";
const outputRelativePath = "skills/decision-records/scripts/decision-records.mjs";

async function buildArtifact(): Promise<string> {
  const bundled = await bundleWithBun({
    cwd: rootDir,
    entryPath: path.join(rootDir, sourceRelativePath),
    format: "esm",
    minify: true
  });
  return addGeneratedFileHeader(bundled, {
    artifactName: "decision-records CLI",
    rebuildCommand: "bun run sync:decision-records-cli",
    repository: githubRepository,
    skillSourcePath: "skills/decision-records",
    sourcePath: sourceRelativePath
  });
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const outputPath = path.join(rootDir, outputRelativePath);
  const expected = await buildArtifact();
  const result = await syncGeneratedFile(outputPath, expected, mode);

  if (result === "current") {
    console.log("Decision records CLI generated artifact is current.");
    return;
  }

  if (result === "stale") {
    console.error(`${toPosix(outputRelativePath)} is missing or not generated from ${sourceRelativePath}`);
    process.exit(1);
  }

  console.log(`Wrote ${toPosix(outputRelativePath)}`);
}

await main();
