import { isDecisionTag } from "../../decision-records/src/decision-path.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDecisionCandidate } from "../../decision-records/src/decision-candidate-service.ts";
import { runDecisionRecordsCli } from "../../decision-records/src/cli.ts";
import {
  candidateDecisionBody,
  decisionIdForTest
} from "../../decision-records/tests/support-record-fixture.ts";
import { createInvestigationCandidate } from "../../investigation-report/src/candidate.ts";
import { publishInvestigationCandidates } from "../../investigation-report/src/publish.ts";
import { reportMarkdown } from "../../investigation-report/tests/fixture-support.ts";

type Domain = "decision" | "investigation";

/** Each umask belongs to a child process, never the parent test runner. */
export function assertNativeCreationModes(domain: Domain): void {
  for (const mask of [0o002, 0o022, 0o200]) {
    const output = execFileSync(
      "node",
      [fileURLToPath(import.meta.url), domain, String(mask)],
      { encoding: "utf8" }
    );
    assert.match(output, /native creation and first index verified/);
  }
}

async function verifyDecisionModes(root: string, expected: number) {
  const id = decisionIdForTest("261023-native-mode");
  const tag = "candidate";
  assert.ok(isDecisionTag(tag));
  const created = await createDecisionCandidate({
    workspaceRoot: root,
    decisionId: id,
    title: "创建权限",
    purpose: "验证原生创建请求",
    background: "保留 umask 限制",
    decision: "验收实际 handle 表示",
    tags: [tag],
    relations: []
  });
  assert.equal(created.status, "ok");
  if (created.status !== "ok") throw new Error("Candidate creation failed");
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

async function verifyInvestigationModes(root: string, expected: number) {
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
    path.join(root, "docs/investigations/native-mode.md"),
    0o640
  );
}

async function assertMode(target: string, expected: number): Promise<void> {
  assert.equal((await fs.stat(target)).mode & 0o7777, expected, target);
}

async function runChild(): Promise<void> {
  const domain = process.argv[2];
  assert.ok(domain === "decision" || domain === "investigation");
  const mask = Number(process.argv[3]);
  const expected =
    domain === "decision"
      ? new Map([
          [0o002, 0o664],
          [0o022, 0o644],
          [0o200, 0o466]
        ])
      : new Map([
          [0o002, 0o600],
          [0o022, 0o600],
          [0o200, 0o400]
        ]);
  const mode = expected.get(mask);
  assert.notEqual(mode, undefined);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "record-native-modes-"));
  const originalMask = process.umask();
  try {
    await fs.mkdir(
      path.join(
        root,
        "docs",
        domain === "decision" ? "decisions" : "investigations"
      ),
      { recursive: true }
    );
    process.umask(mask);
    if (domain === "decision") await verifyDecisionModes(root, mode!);
    else await verifyInvestigationModes(root, mode!);
    console.log(
      "native creation and first index verified",
      domain,
      mask.toString(8),
      mode!.toString(8)
    );
  } finally {
    process.umask(originalMask);
    await fs.rm(root, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runChild();
