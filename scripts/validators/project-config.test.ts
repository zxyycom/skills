import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRepositoryPermissionRules } from "./project-config.ts";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

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
