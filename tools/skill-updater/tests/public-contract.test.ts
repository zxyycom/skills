import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  rootDir,
  skillName,
  generatedUpdaterPath,
  validRelease,
  runUpdater,
  tempRoot,
  mockFetchPath,
  remoteSkillMarkdown,
  zipData,
  validManifest,
  copyUpdaterSkill,
  runSkillUpdaterCli,
  skillUpdaterConfig
} from "./support.ts";

test("updater configuration exposes the public contract", () => {
  assert.equal(skillUpdaterConfig.skillName, skillName);
  assert.equal(
    skillUpdaterConfig.releaseManifestAssetName,
    "skill-release-manifest.json"
  );
  assert.equal(typeof runSkillUpdaterCli, "function");
});

test("updater help exposes the public CLI contract", async () => {
  const helpOutput: string[] = [];
  const originalConsoleLog = console.log;
  console.log = (...values: unknown[]) => {
    helpOutput.push(values.map(String).join(" "));
  };
  try {
    assert.equal(await runSkillUpdaterCli(["--help"]), 0);
  } finally {
    console.log = originalConsoleLog;
  }
  assert.match(helpOutput.join("\n"), /Usage: node update-skill\.ts/);
  assert.match(
    helpOutput.join("\n"),
    /installed version differs from the remote version/
  );
});

test("updater TypeScript entry exposes the public API and consumer types", async () => {
  const generatedEntry = await fs.readFile(generatedUpdaterPath, "utf8");
  assert.match(
    generatedEntry,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/skill-updater\/src\/index\.ts/
  );
  assert.match(generatedEntry, /export type \{ UpdaterConfig \}/);
  assert.match(generatedEntry, /export async function runSkillUpdaterCli/);
  assert.match(generatedEntry, /export const skillUpdaterConfig/);
  const consumerPath = path.join(tempRoot, "updater-consumer.mts");
  await fs.writeFile(
    consumerPath,
    `import { runSkillUpdaterCli, skillUpdaterConfig, type UpdaterConfig } from ${JSON.stringify(generatedUpdaterPath)}; const config: Readonly<UpdaterConfig> = skillUpdaterConfig; const run: (argv?: readonly string[]) => Promise<number> = runSkillUpdaterCli; void config; void run;`
  );
  const types = spawnSync(
    path.join(rootDir, "node_modules/.bin/tsgo"),
    [
      "--noEmit",
      "--strict",
      "--types",
      "node",
      "--typeRoots",
      path.join(rootDir, "node_modules/@types"),
      "--module",
      "nodenext",
      "--target",
      "es2024",
      "--allowImportingTsExtensions",
      "--erasableSyntaxOnly",
      consumerPath
    ],
    { encoding: "utf8", cwd: tempRoot }
  );
  assert.equal(types.status, 0, types.stdout + types.stderr);
});

test("updater default target follows its public module URL through an external importer", async () => {
  const target = path.join(tempRoot, "importer-target");
  await copyUpdaterSkill(target);
  await fs.symlink(
    path.join(rootDir, "node_modules"),
    path.join(target, "node_modules"),
    "dir"
  );
  await fs.writeFile(path.join(target, "SKILL.md"), remoteSkillMarkdown);
  const importer = path.join(tempRoot, "external-importer.mjs");
  const updaterUrl = pathToFileURL(
    path.join(target, "scripts/update-skill.ts")
  ).href;
  await fs.writeFile(
    importer,
    `import { runSkillUpdaterCli } from ${JSON.stringify(updaterUrl)}; process.exitCode = await runSkillUpdaterCli(["--check"]);`
  );
  const result = runUpdater(mockFetchPath, {
    args: [],
    manifest: validManifest,
    release: validRelease,
    targetDir: target,
    updaterPath: importer,
    useDefaultTarget: true,
    zipData
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.split("\n").includes(`Target: ${target}`), true);
  assert.match(result.stdout, /Status: current/);
  assert.equal(
    await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
    remoteSkillMarkdown
  );
});
