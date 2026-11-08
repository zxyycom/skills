import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("retired publisher entry fails before any release operation", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, "scripts/publish-skills.ts"), "rolling"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Retired TypeScript skill publisher/);
});
