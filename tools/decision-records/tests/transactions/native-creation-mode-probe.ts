import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNativeCreationModeProbe } from "../../../record-operations/tests/transactions/transaction-creation-modes.ts";
import { isDecisionTag } from "../../src/collection/decision-path.ts";
import { createDecisionCandidate } from "../../src/candidates/decision-candidate-service.ts";
import { runDecisionRecordsCli } from "../../src/cli.ts";
import {
  candidateDecisionBody,
  decisionIdForTest
} from "../support/support-record-fixture.ts";

async function verifyDecisionModes(
  root: string,
  expected: number
): Promise<void> {
  const tag = "candidate";
  assert.ok(isDecisionTag(tag));
  const created = await createDecisionCandidate({
    workspaceRoot: root,
    decisionId: decisionIdForTest("native-mode"),
    title: "创建权限",
    purpose: "验证原生创建请求",
    background: "保留 umask 限制",
    decision: "验收实际 handle 表示",
    tags: [tag],
    relations: []
  });
  assert.equal(created.status, "ok");
  if (created.status !== "ok") throw new Error("Candidate creation failed");
  const id = created.decisionId;
  const candidate = path.join(root, "docs/decisions", created.sourcePath);
  await assertMode(candidate, expected);
  await fs.chmod(candidate, 0o640);
  await fs.writeFile(candidate, candidateDecisionBody({ id }));
  const errors: string[] = [];
  const code = await runDecisionRecordsCli(
    ["--root", root, "publish", id, "--alignment", "unaligned"],
    { io: { stdout: () => {}, stderr: (text) => errors.push(text) } }
  );
  assert.equal(code, 0, errors.join(""));
  await assertMode(
    path.join(root, "docs/decisions/decision-index.json"),
    expected
  );
  await assertMode(candidate, 0o640);
}

async function assertMode(target: string, expected: number): Promise<void> {
  assert.equal((await fs.stat(target)).mode & 0o7777, expected, target);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await runNativeCreationModeProbe({
    prepare: async (root) => {
      await fs.mkdir(path.join(root, "docs/decisions"), { recursive: true });
    },
    verify: verifyDecisionModes
  });
