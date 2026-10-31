import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { repositoryRoot, validDesign, validProposal } from "../support.ts";

function node(cli: string, args: readonly string[]) {
  return spawnSync("node", [cli, ...args], { encoding: "utf8" });
}
async function copySkill(root: string): Promise<string> {
  const target = path.join(root, "skill");
  await fs.cp(path.join(repositoryRoot, "skills/change-plan"), target, {
    recursive: true,
    filter: (source) => path.basename(source) !== "node_modules"
  });
  return target;
}
async function verifyDraftCheck(cli: string, root: string): Promise<void> {
  const directory = path.join(root, "changes/demo");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, ".change-plan.json"),
    '{"stage":"draft"}'
  );
  await fs.writeFile(path.join(directory, "proposal.md"), validProposal);
  await fs.writeFile(path.join(directory, "design.md"), validDesign);
  const result = node(cli, ["check", directory, "--json"]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /"valid": true/u);
}

function install(skill: string): void {
  const result = spawnSync(
    "pnpm",
    [
      "--dir",
      skill,
      "install",
      "--ignore-workspace",
      "--prod",
      "--frozen-lockfile",
      "--config.node-linker=isolated"
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr + result.stdout);
}

test(
  "distributed TypeScript runs after frozen installation and edits take effect without building",
  { timeout: 60000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "change-plan-ts-frozen-")
    );
    try {
      const skill = await copySkill(root);
      const lockPath = path.join(skill, "pnpm-lock.yaml");
      const lock = await fs.readFile(lockPath, "utf8");
      install(skill);
      assert.equal(await fs.readFile(lockPath, "utf8"), lock);
      assert.equal(
        await fs.stat(path.join(skill, "pnpm-workspace.yaml")).then(
          () => true,
          () => false
        ),
        false
      );
      const cli = path.join(skill, "scripts/change-plan.ts");
      await fs.writeFile(
        path.join(skill, "consumer.ts"),
        'import { runChangePlanCli, type ChangePlanStage } from "./scripts/change-plan.ts"; const stage: ChangePlanStage = "draft"; void stage; void runChangePlanCli;'
      );
      const typecheck = spawnSync(
        path.join(repositoryRoot, "node_modules/.bin/tsgo"),
        [
          "--noEmit",
          "--strict",
          "--types",
          "node",
          "--module",
          "nodenext",
          "--target",
          "es2024",
          "--allowImportingTsExtensions",
          "consumer.ts"
        ],
        { cwd: skill, encoding: "utf8" }
      );
      assert.equal(typecheck.status, 0, typecheck.stdout + typecheck.stderr);
      const result = node(cli, ["--help"]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /change-plan\.ts check/u);
      await verifyDraftCheck(path.join(skill, "scripts/change-plan.ts"), root);
      const source = path.join(
        skill,
        "scripts/runtime/tools/change-plan/src/cli-output.ts"
      );
      await fs.writeFile(
        source,
        (await fs.readFile(source, "utf8")).replace(
          '"Usage:"',
          '"Edited locally:"'
        )
      );
      const edited = node(cli, ["--help"]);
      assert.equal(edited.status, 0, edited.stderr);
      assert.match(edited.stdout, /Edited locally:/u);
      const imported = spawnSync(
        "node",
        [
          "--input-type=module",
          "-e",
          `await import(${JSON.stringify(pathToFileURL(cli).href)})`
        ],
        { encoding: "utf8" }
      );
      assert.equal(imported.status, 0, imported.stderr);
      assert.equal(imported.stdout, "");
      assert.equal(imported.stderr, "");
      const invalid = node(cli, ["--unknown"]);
      assert.equal(invalid.status, 2);
      assert.equal(invalid.stdout, "");
      assert.match(invalid.stderr, /Unknown option/u);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
);

test(
  "distributed TypeScript reuses a compatible different host dependency without a local install",
  { timeout: 60000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "change-plan-ts-host-")
    );
    try {
      await fs.writeFile(
        path.join(root, "package.json"),
        JSON.stringify({
          private: true,
          dependencies: {
            "mdast-util-from-markdown": "2.0.3",
            "mdast-util-to-string": "4.0.0",
            "simple-git": "3.36.0",
            valibot: "1.4.2"
          }
        })
      );
      const skill = await copySkill(root);
      const localModules = path.join(skill, "node_modules");
      assert.equal(
        await fs.stat(localModules).then(
          () => true,
          () => false
        ),
        false
      );
      const installed = spawnSync(
        "pnpm",
        [
          "--dir",
          root,
          "install",
          "--ignore-workspace",
          "--config.node-linker=isolated"
        ],
        { encoding: "utf8" }
      );
      assert.equal(installed.status, 0, installed.stderr + installed.stdout);
      const result = node(path.join(skill, "scripts/change-plan.ts"), [
        "--help"
      ]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /change-plan\.ts check/u);
      await verifyDraftCheck(path.join(skill, "scripts/change-plan.ts"), root);
      const hostManifest: unknown = JSON.parse(
        await fs.readFile(
          path.join(root, "node_modules/mdast-util-from-markdown/package.json"),
          "utf8"
        )
      );
      assert.ok(
        typeof hostManifest === "object" &&
          hostManifest !== null &&
          "version" in hostManifest
      );
      assert.equal(hostManifest.version, "2.0.3");
      assert.match(
        await fs.readFile(path.join(skill, "pnpm-lock.yaml"), "utf8"),
        /mdast-util-from-markdown@2\.1\.0/u
      );
      assert.equal(
        await fs.stat(localModules).then(
          () => true,
          () => false
        ),
        false
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
);

test(
  "uninstalled TypeScript reports missing dependencies without implicitly installing",
  { timeout: 60000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "change-plan-ts-missing-")
    );
    try {
      const skill = await copySkill(root);
      const cli = path.join(skill, "scripts/change-plan.ts");
      const result = node(cli, ["--help"]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/u);
      assert.match(result.stderr, /Cannot find package/u);
      assert.equal(
        await fs.stat(path.join(skill, "node_modules")).then(
          () => true,
          () => false
        ),
        false
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
);

test(
  "resolvable incompatible dependency reports its API failure and explicit frozen installation restores execution",
  { timeout: 60000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "change-plan-ts-incompatible-")
    );
    try {
      const skill = await copySkill(root);
      const incompatible = path.join(root, "node_modules/valibot");
      await fs.mkdir(path.join(root, "node_modules"));
      for (const dependency of [
        "simple-git",
        "mdast-util-from-markdown",
        "mdast-util-to-string"
      ]) {
        await fs.symlink(
          path.join(repositoryRoot, "node_modules", dependency),
          path.join(root, "node_modules", dependency),
          process.platform === "win32" ? "junction" : "dir"
        );
      }
      await fs.mkdir(incompatible, { recursive: true });
      await fs.writeFile(
        path.join(incompatible, "package.json"),
        '{"name":"valibot","version":"0.0.0-fixture","type":"module","exports":"./index.js"}'
      );
      await fs.writeFile(
        path.join(incompatible, "index.js"),
        "export const incompatible = true;"
      );
      const cli = path.join(skill, "scripts/change-plan.ts");
      const failed = node(cli, ["--help"]);
      assert.equal(failed.status, 1);
      assert.match(failed.stderr, /not a function|does not provide an export/u);
      assert.match(failed.stderr, /--frozen-lockfile/u);
      assert.match(failed.stderr, /No installation was attempted/u);
      assert.equal(
        await fs.readFile(path.join(incompatible, "index.js"), "utf8"),
        "export const incompatible = true;"
      );
      install(skill);
      const restored = node(cli, ["--help"]);
      assert.equal(restored.status, 0, restored.stderr);
      assert.match(restored.stdout, /change-plan\.ts check/u);
      assert.equal(
        await fs.readFile(path.join(incompatible, "index.js"), "utf8"),
        "export const incompatible = true;"
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }
);
