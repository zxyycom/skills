import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { syncTestEvidenceIndex } from "../src/core.ts";

export const exec = promisify(execFile);
export { fs, path };
export async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-core-"));
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await fs.writeFile(
    path.join(cases, "access.md"),
    "### Case AUTH-ROLE-ACCESS-001: access is rejected\n\nTests:\n- `test:access`\n- `test:shared`\n\nTags:\n- `access-control`\n- `security`\n\nContract:\n- access requires permission\n\nProves:\n- rejection is observable\n"
  );
  await fs.writeFile(
    path.join(cases, "second.md"),
    "### Case AUTH-ROLE-ACCESS-002: shared intent\n\nTests:\n- `test:shared`\n\nContract:\n- shared behavior is stable\n\nProves:\n- result is observable\n"
  );
  return root;
}
export async function commitFixture(withIndex = true): Promise<string> {
  const root = await fixture();
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root
  });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  if (withIndex)
    await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "baseline"], { cwd: root });
  return root;
}
