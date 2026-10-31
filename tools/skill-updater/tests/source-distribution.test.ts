import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { zipSync } from "fflate";
import { pathExists } from "../../shared/src/node/filesystem.ts";
import { bundleWithBun } from "../../../scripts/lib/generation/generated-file.ts";
import {
  rootDir,
  skillName,
  generatedUpdaterPath,
  validRelease,
  skillMarkdown,
  runUpdater,
  tempRoot,
  mockFetchPath,
  remoteSkillMarkdown,
  validManifest,
  copyUpdaterSkill,
  sourcePackageZip,
  skillUpdaterConfig
} from "./support.ts";

test("MJS-format bundled updater installs TypeScript packages and retains local files", async () => {
  const target = path.join(tempRoot, "legacy-target");
  await fs.mkdir(path.join(target, "scripts"), { recursive: true });
  const legacyPath = path.join(target, "scripts/update-skill.mjs");
  // This fixture proves the self-contained MJS entry format and unchanged zip
  // protocol, not the behavior of an immutable historical implementation.
  const fixtureEntry = path.join(tempRoot, "legacy-format-entry.ts");
  await fs.writeFile(
    fixtureEntry,
    `import { runSkillUpdaterCli } from ${JSON.stringify(path.join(rootDir, "tools/skill-updater/src/index.ts"))};
try { process.exitCode = await runSkillUpdaterCli(${JSON.stringify(skillUpdaterConfig)}, import.meta.url, process.argv.slice(2)); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }`
  );
  const legacy = await bundleWithBun({
    cwd: rootDir,
    entryPath: fixtureEntry,
    outputFileName: "update-skill.mjs",
    format: "esm",
    keepNames: true,
    minify: false
  });
  await fs.writeFile(legacyPath, legacy.code);
  await fs.writeFile(
    path.join(target, "SKILL.md"),
    skillMarkdown(1, "old installation")
  );
  await fs.writeFile(
    path.join(target, "custom.txt"),
    "preserve legacy customization"
  );
  const packageDirectory = path.join(tempRoot, "legacy-remote-package");
  await copyUpdaterSkill(packageDirectory);
  const result = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: target,
    updaterPath: legacyPath,
    zipData: await sourcePackageZip(packageDirectory)
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await fs.readFile(legacyPath, "utf8"), legacy.code);
  assert.equal(
    await fs.readFile(path.join(target, "custom.txt"), "utf8"),
    "preserve legacy customization"
  );
  assert.equal(
    await fs.readFile(path.join(target, "scripts/update-skill.ts"), "utf8"),
    await fs.readFile(generatedUpdaterPath, "utf8")
  );
  assert.equal(await pathExists(path.join(target, "pnpm-lock.yaml")), true);
});

test("TypeScript updater overwrites its loaded runtime and retains local files", async () => {
  const target = path.join(tempRoot, "self-update-target");
  await copyUpdaterSkill(target);
  await fs.symlink(
    path.join(rootDir, "node_modules"),
    path.join(target, "node_modules"),
    "dir"
  );
  await fs.writeFile(
    path.join(target, "SKILL.md"),
    skillMarkdown(1, "old TS installation")
  );
  await fs.writeFile(
    path.join(target, "custom.txt"),
    "preserve TS customization"
  );
  const runtimePath = path.join(
    target,
    "scripts/runtime/tools/skill-updater/src/index.ts"
  );
  const originalRuntime = await fs.readFile(runtimePath, "utf8");
  const zip = zipSync({
    [`${skillName}/SKILL.md`]: Buffer.from(remoteSkillMarkdown),
    [`${skillName}/scripts/update-skill.ts`]:
      await fs.readFile(generatedUpdaterPath),
    [`${skillName}/scripts/runtime/tools/skill-updater/src/index.ts`]:
      Buffer.from(
        originalRuntime.replace(
          "Updated skill successfully.",
          "Updated by replacement runtime."
        )
      )
  });
  const updaterPath = path.join(target, "scripts/update-skill.ts");
  const updated = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: target,
    updaterPath,
    zipData: zip
  });
  assert.equal(updated.status, 0, updated.stderr);
  assert.match(updated.stdout, /Updated skill successfully\./);
  assert.doesNotMatch(updated.stdout, /Updated by replacement runtime/);
  assert.match(
    await fs.readFile(runtimePath, "utf8"),
    /Updated by replacement runtime/
  );
  assert.equal(
    await fs.readFile(path.join(target, "custom.txt"), "utf8"),
    "preserve TS customization"
  );
  // A fresh process must read the replacement rather than an old module cache.
  await fs.writeFile(
    path.join(target, "SKILL.md"),
    skillMarkdown(1, "retry new runtime")
  );
  const retried = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: target,
    updaterPath,
    zipData: zip
  });
  assert.equal(retried.status, 0, retried.stderr);
  assert.match(retried.stdout, /Updated by replacement runtime/);
});

test(
  "updater load failures give explicit recovery and frozen installation restores execution",
  { timeout: 60_000 },
  async () => {
    const target = path.join(tempRoot, "recovery-target");
    await copyUpdaterSkill(target);
    const updaterPath = path.join(target, "scripts/update-skill.ts");
    const lockPath = path.join(target, "pnpm-lock.yaml");
    const lock = await fs.readFile(lockPath, "utf8");
    const imported = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `globalThis.fetch = () => { throw new Error('unexpected network'); }; await import(${JSON.stringify(pathToFileURL(updaterPath).href)});`
      ],
      { encoding: "utf8", cwd: target }
    );
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, "");
    assert.equal(imported.stderr, "");
    const failed = spawnSync("node", [updaterPath, "--help"], {
      encoding: "utf8",
      cwd: target
    });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /Unable to load skill updater runtime:/);
    assert.match(failed.stderr, /Cannot find package/);
    assert.match(
      failed.stderr,
      /--ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated/
    );
    assert.match(failed.stderr, /re-obtain this skill/);
    assert.equal(await pathExists(path.join(target, "node_modules")), false);
    assert.equal(await fs.readFile(lockPath, "utf8"), lock);
    const install = spawnSync(
      "pnpm",
      [
        "--dir",
        target,
        "install",
        "--ignore-workspace",
        "--prod",
        "--frozen-lockfile",
        "--config.node-linker=isolated"
      ],
      { encoding: "utf8" }
    );
    assert.equal(install.status, 0, install.stdout + install.stderr);
    assert.equal(await fs.readFile(lockPath, "utf8"), lock);
    const recovered = spawnSync("node", [updaterPath, "--help"], {
      encoding: "utf8",
      cwd: tempRoot
    });
    assert.equal(recovered.status, 0, recovered.stderr);
    assert.match(recovered.stdout, /Usage: node update-skill\.ts/);
  }
);

test("incompatible updater dependencies preserve the loading error without implicit installation", async () => {
  const target = path.join(tempRoot, "incompatible-target");
  await copyUpdaterSkill(target);
  const modules = path.join(target, "node_modules");
  await fs.mkdir(path.join(modules, "valibot"), { recursive: true });
  for (const dependency of ["fflate", "yaml"]) {
    await fs.symlink(
      path.join(rootDir, "node_modules", dependency),
      path.join(modules, dependency),
      "dir"
    );
  }
  await fs.writeFile(
    path.join(modules, "valibot/package.json"),
    '{"name":"valibot","type":"module","exports":"./index.js"}'
  );
  const incompatibleSource = "export const incompatibleApi = true;";
  await fs.writeFile(
    path.join(modules, "valibot/index.js"),
    incompatibleSource
  );
  const result = spawnSync(
    "node",
    [path.join(target, "scripts/update-skill.ts"), "--help"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unable to load skill updater runtime/);
  assert.match(result.stderr, /v\.\w+ is not a function/);
  assert.match(result.stderr, /frozen-lockfile/);
  assert.equal(
    await fs.readFile(path.join(modules, "valibot/index.js"), "utf8"),
    incompatibleSource
  );
});
