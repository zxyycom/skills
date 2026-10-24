import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNativeCreationModeProbe } from "../../record-operations/tests/transaction-creation-modes.ts";
import { createInvestigationCandidate } from "../src/candidate.ts";
import { publishInvestigationCandidates } from "../src/publish.ts";
import { reportMarkdown } from "./fixture-support.ts";

async function verifyInvestigationModes(
  root: string,
  expected: number
): Promise<void> {
  const id = "261023-native-mode";
  const created = await createInvestigationCandidate({
    workspaceRoot: root,
    id,
    formedAt: "2026-10-23T00:00:00+00:00",
    title: "创建权限",
    question: "是否保留原生创建限制？",
    tags: ["candidate"],
    relations: []
  });
  assert.equal(created.status, "ok", created.errors.join("; "));
  assert.ok(created.candidate);
  await assertMode(created.candidate.path, expected);
  await fs.chmod(created.candidate.path, 0o640);
  await fs.writeFile(
    created.candidate.path,
    reportMarkdown({ id, formedAt: "2026-10-23T00:00:00+00:00" })
  );
  const published = await publishInvestigationCandidates({
    workspaceRoot: root,
    ids: [id]
  });
  assert.deepEqual(published.errors, []);
  assert.equal(published.changed, true);
  await assertMode(
    path.join(root, "docs/investigations/investigation-index.json"),
    expected
  );
  await assertMode(
    path.join(root, "docs/investigations/261023-native-mode.md"),
    0o640
  );
}

async function assertMode(target: string, expected: number): Promise<void> {
  assert.equal((await fs.stat(target)).mode & 0o7777, expected, target);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await runNativeCreationModeProbe({
    prepare: async (root) => {
      await fs.mkdir(path.join(root, "docs/investigations"), {
        recursive: true
      });
    },
    verify: verifyInvestigationModes
  });
