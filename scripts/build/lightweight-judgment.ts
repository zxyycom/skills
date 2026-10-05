import fs from "node:fs/promises";
import path from "node:path";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";

const rebuildCommand = "bun run sync:lightweight-judgment-cli";
const skillSourcePath = "skills/lightweight-judgment";
const sourceRelativePath = "tools/lightweight-judgment/src/cli.ts";
const outputRelativePath =
  "skills/lightweight-judgment/scripts/lightweight-judgment.mjs";
const migrationSourcePath =
  "tools/lightweight-judgment/migrations/log-v1-to-v2.sql";

async function buildArtifacts(): Promise<GeneratedArtifact[]> {
  const bundle = await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: "lightweight judgment inference CLI",
      rebuildCommand,
      repository: githubRepository,
      skillSourcePath,
      sourcePath: sourceRelativePath
    }),
    cwd: rootDir,
    entryPath: path.join(rootDir, sourceRelativePath),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: path.basename(outputRelativePath),
    sourceMapBaseDirectory: path.dirname(
      path.join(rootDir, outputRelativePath)
    ),
    sourceMap: true
  });
  if (bundle.sourceMap === null) {
    throw new Error(
      "Lightweight Judgment CLI bundle must include a source map"
    );
  }
  const serializedWorkspacePath = JSON.stringify(rootDir).slice(1, -1);
  if (
    bundle.code.includes(rootDir) ||
    bundle.code.includes(serializedWorkspacePath)
  ) {
    throw new Error(
      "Lightweight Judgment CLI bundle contains an absolute workspace path"
    );
  }

  const outputPath = path.join(rootDir, outputRelativePath);
  return [
    {
      content: bundle.code,
      path: outputPath,
      sourcePath: sourceRelativePath
    },
    {
      content: bundle.sourceMap,
      path: `${outputPath}.map`,
      sourcePath: sourceRelativePath
    },
    {
      content: `${buildGeneratedFileHeader({
        artifactName: "lightweight judgment log v1 to v2 migration",
        rebuildCommand,
        repository: githubRepository,
        skillSourcePath,
        sourcePath: migrationSourcePath
      })}\n\n${await fs.readFile(path.join(rootDir, migrationSourcePath), "utf8")}`,
      path: path.join(
        rootDir,
        skillSourcePath,
        "migrations/log-v1-to-v2/migrate.sql"
      ),
      sourcePath: migrationSourcePath
    }
  ];
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const changed = await syncGeneratedArtifacts(
    await buildArtifacts(),
    mode,
    rootDir,
    sourceRelativePath
  );

  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("Lightweight Judgment generated artifacts are current.");
  }
}

await main();
