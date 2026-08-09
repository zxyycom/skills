import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  maintenanceCliPackageScripts,
  validatePackageScripts,
  validateRepositoryPermissionRules
} from "./project-config.ts";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

test("project package scripts preserve maintenance CLI delegations", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills package scripts ")
  );
  try {
    const currentPackageJson = await fs.readFile(
      path.join(workspaceRoot, "package.json"),
      "utf8"
    );
    const packageJsonPath = path.join(tempRoot, "package.json");
    await fs.writeFile(packageJsonPath, currentPackageJson, "utf8");

    const currentErrors: string[] = [];
    await validatePackageScripts(
      (message) => currentErrors.push(message),
      tempRoot
    );
    assert.deepEqual(currentErrors, []);

    const expectedDecisionCommand = maintenanceCliPackageScripts[
      "decision-records"
    ];
    const invalidPackageJson = currentPackageJson.replace(
      JSON.stringify(expectedDecisionCommand),
      JSON.stringify("node scripts/wrong-decision-entry.mjs")
    );
    assert.notEqual(invalidPackageJson, currentPackageJson);
    await fs.writeFile(packageJsonPath, invalidPackageJson, "utf8");

    const invalidErrors: string[] = [];
    await validatePackageScripts(
      (message) => invalidErrors.push(message),
      tempRoot
    );
    assert.deepEqual(invalidErrors, [
      `package.json script decision-records must delegate to ${expectedDecisionCommand}`
    ]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("project package script validation maps invalid JSON boundaries", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills invalid package json ")
  );
  try {
    const packageJsonPath = path.join(tempRoot, "package.json");
    await fs.writeFile(packageJsonPath, "{\n", "utf8");

    const malformedErrors: string[] = [];
    await validatePackageScripts(
      (message) => malformedErrors.push(message),
      tempRoot
    );
    assert.equal(malformedErrors.length, 1);
    assert.match(malformedErrors[0] ?? "", /^package\.json is not valid JSON:/u);

    await fs.writeFile(packageJsonPath, "{\"scripts\":[]}\n", "utf8");
    const invalidShapeErrors: string[] = [];
    await validatePackageScripts(
      (message) => invalidShapeErrors.push(message),
      tempRoot
    );
    assert.deepEqual(invalidShapeErrors, [
      "package.json scripts must be an object"
    ]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("repository permission rules cover environment setup without stale or blanket entries", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills permission rules ")
  );
  try {
    const rulesDirectory = path.join(tempRoot, ".codex", "rules");
    await fs.mkdir(rulesDirectory, { recursive: true });
    const currentRules = await fs.readFile(
      path.join(workspaceRoot, ".codex", "rules", "bun.rules"),
      "utf8"
    );
    const rulesPath = path.join(rulesDirectory, "bun.rules");
    await fs.writeFile(rulesPath, currentRules, "utf8");

    const currentErrors: string[] = [];
    await validateRepositoryPermissionRules(
      (message) => currentErrors.push(message),
      tempRoot
    );
    assert.deepEqual(currentErrors, []);

    const removedHookEntry = [
      "scripts",
      ["setup-git-hooks", "ts"].join(".")
    ].join("/");
    const staleRules = currentRules.replace(
      'prefix_rule(pattern=["node", "scripts/setup-repository.js"], decision="prompt")',
      `prefix_rule(pattern=["bun", "${removedHookEntry}"], decision="prompt")`
    ) + 'prefix_rule(pattern=["bun", "run", "task-graph"], decision="allow")\n';
    await fs.writeFile(rulesPath, staleRules, "utf8");
    const staleErrors: string[] = [];
    await validateRepositoryPermissionRules(
      (message) => staleErrors.push(message),
      tempRoot
    );
    assert.ok(staleErrors.some((message) =>
      message.includes("must prompt node scripts/setup-repository.js")
    ));
    assert.ok(staleErrors.some((message) =>
      message.includes(`must not reference removed entry ${removedHookEntry}`)
    ));
    assert.ok(staleErrors.some((message) =>
      message.includes("must not blanket allow bun run task-graph")
    ));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
