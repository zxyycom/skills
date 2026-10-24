import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "node:test";
import { promisify } from "node:util";
import { syncTestEvidenceIndex } from "../src/core.ts";
import * as v from "valibot";
import { testEvidenceStateIndexSchema } from "../src/core-schemas.ts";

export const exec = promisify(execFile);
export { fs, path };
const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true }))
  );
});

export async function temporaryRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

export async function fixture(): Promise<string> {
  const root = await temporaryRoot("test-evidence-core-");
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

/** Decode the persisted index boundary before inspecting or deliberately mutating it. */
export function parseIndexJson(
  text: string
): v.InferOutput<typeof testEvidenceStateIndexSchema> {
  const value: unknown = JSON.parse(text);
  return v.parse(testEvidenceStateIndexSchema, value);
}
