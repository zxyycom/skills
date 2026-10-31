import assert from "node:assert/strict";
import test from "node:test";
import {
  isActivationCandidateRecord,
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionRecord
} from "../../src/types.ts";
import { decisionScanFromSources } from "../support/domain-fixture.ts";
import {
  candidateDecisionBody,
  currentDecisionId
} from "../support/support-record-fixture.ts";

test("a valid candidate scaffold remains discoverable until its body is ready", async () => {
  const candidateId = "use-candidate-scaffold";
  const scan = await decisionScanFromSources([
    {
      id: candidateId,
      text: emptyCandidateScaffold(candidateDecisionBody({ id: candidateId }))
    }
  ]);
  const candidate = scan.records.find(
    (record) => record.decisionId === candidateId
  );
  assert.ok(candidate);
  assert.deepEqual(scan.sourceErrors, []);
  assert.equal(
    scan.records.filter((record) => record.activationCandidate).length,
    0
  );
  assert.equal(candidate.scaffoldValid, true);
  assert.equal(candidate.bodyReady, false);
  assert.equal(candidate.activationCandidate, false);
  assert.equal(isDecisionCandidateRecord(candidate), true);
  assert.equal(isActivationCandidateRecord(candidate), false);
});

test("record type guards reject invalid identity fields from real candidate and established scans", async () => {
  const candidateId = "use-record-guard-candidate";
  const scan = await decisionScanFromSources([
    { id: candidateId },
    { id: currentDecisionId, status: "active" }
  ]);
  assert.deepEqual(scan.sourceErrors, []);
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
});

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
