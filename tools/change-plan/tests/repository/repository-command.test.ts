import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../../../", import.meta.url));

test("repository short command change-plan invokes its owned skill CLI", () => {
  const stdout = execFileSync(
    "bun",
    ["run", "--silent", "change-plan", "--", "--help"],
    { cwd: workspaceRoot, encoding: "utf8", timeout: 30_000 }
  );
  assert.match(stdout, /change-plan\.ts check-all/u);
});
