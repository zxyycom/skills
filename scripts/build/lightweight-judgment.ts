import type { SourceRuntimeFacts } from "../lib/source-runtime.ts";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildGeneratedFileHeader,
  type GeneratedArtifact,
  type GeneratedFileMode
} from "../lib/generated-file.ts";
import { nativeCliEntry } from "../lib/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/skill-runtime.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
const rebuildCommand = "bun run sync:lightweight-judgment-cli";
const skillSourcePath = "skills/lightweight-judgment";
const migrations = ["log-v1-to-v2", "log-v2-to-v3"] as const;
export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
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
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName: "lightweight-judgment",
      rebuildCommand,
      nodeEngine: ">=24.18",
      entries: [
        await nativeCliEntry({
          sourcePath: "tools/lightweight-judgment/src/cli.ts",
          outputName: "lightweight-judgment.ts",
          runner: "runCli",
          invocation: `const outcome = await runtime.runCli(process.argv.slice(2), runtime.productionRuntime());
    process.stdout.write(outcome.stdout);
    process.stderr.write(outcome.stderr);
    process.exitCode = outcome.exitCode;`
        })
      ]
    },
    facts
  );
  artifacts.push(...migrationArtifacts);
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "lightweight-judgment",
    retiredPaths: [
      "scripts/lightweight-judgment.mjs",
      "scripts/lightweight-judgment.mjs.map"
    ]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);
