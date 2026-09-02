import assert from "node:assert/strict";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  isActivationCandidateRecord,
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionRecord
} from "../src/types.ts";
import {
  candidateDecisionBody,
  currentDecisionId,
  withFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("a valid candidate scaffold remains discoverable until its body is ready", () =>
  withFixtureWorkspace(
    "candidate-scaffold-readiness",
    async (workspaceRoot) => {
      const candidateId = "use-candidate-scaffold.md";
      await writeDecision(
        workspaceRoot,
        candidateId,
        emptyCandidateScaffold(candidateDecisionBody())
      );

      const validation = await validateDecisionRecords({ workspaceRoot });
      const candidate = validation.scan.records.find(
        (record) => record.decisionId === candidateId
      );
      assert.ok(candidate);
      assert.deepEqual(validation.errors, []);
      assert.equal(validation.activationCandidateCount, 0);
      assert.equal(candidate.scaffoldValid, true);
      assert.equal(candidate.bodyReady, false);
      assert.equal(candidate.activationCandidate, false);
      assert.equal(isDecisionCandidateRecord(candidate), true);
      assert.equal(isActivationCandidateRecord(candidate), false);
    }
  ));

test("record type guards reject invalid identity fields from real candidate and established scans", () =>
  withFixtureWorkspace("record-guard-identities", async (workspaceRoot) => {
    const candidateId = "use-record-guard-candidate.md";
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
    const scan = await scanDecisionRecords({ workspaceRoot });
    const candidate = scan.records.find(
      (record) => record.decisionId === candidateId
    );
    const established = scan.records.find(
      (record) => record.decisionId === currentDecisionId
    );
    assert.ok(candidate);
    assert.ok(established);
    assert.equal(isDecisionCandidateRecord(candidate), true);
    assert.equal(isActivationCandidateRecord(candidate), true);
    assert.equal(isEstablishedDecisionRecord(established), true);

    for (const invalidRecord of invalidIdentityRecords(candidate)) {
      assert.equal(isDecisionCandidateRecord(invalidRecord), false);
      assert.equal(isActivationCandidateRecord(invalidRecord), false);
    }
    for (const invalidRecord of invalidIdentityRecords(established)) {
      assert.equal(isEstablishedDecisionRecord(invalidRecord), false);
    }
  }));

function invalidIdentityRecords(record: DecisionRecord): DecisionRecord[] {
  return [
    { ...record, decisionId: "invalid_name.md" },
    { ...record, sourcePath: "nested/invalid-path.md" }
  ];
}

function emptyCandidateScaffold(body: string): string {
  return body
    .replace("- 验证 Markdown 生命周期独立定义候选和已建立状态。\n\n", "")
    .replace("- 索引和版本历史不应共同承担决策成员身份。\n\n", "")
    .replace("- 采用: 使用显式 candidate 状态区分候选与已建立决策。\n", "");
}
