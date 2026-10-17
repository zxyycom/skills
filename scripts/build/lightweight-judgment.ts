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
const migrations = ["log-v1-to-v2", "log-v2-to-v3"] as const;

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
  const migrationArtifacts = await Promise.all(
    migrations.map(async (migration): Promise<GeneratedArtifact> => {
      const sourcePath = `tools/lightweight-judgment/migrations/${migration}.sql`;
      return {
        content: `${buildGeneratedFileHeader({
          artifactName: `lightweight judgment ${migration.replaceAll("-", " ")} migration`,
          rebuildCommand,
          repository: githubRepository,
          skillSourcePath,
          sourcePath
        })}\n\n${await fs.readFile(path.join(rootDir, sourcePath), "utf8")}`,
        path: path.join(
          rootDir,
          skillSourcePath,
          `migrations/${migration}/migrate.sql`
        ),
        sourcePath
      };
    })
  );
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
    ...migrationArtifacts
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
