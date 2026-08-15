import assert from "node:assert/strict";
import test from "node:test";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  isActivationCandidateRecord,
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionRecord,
} from "../src/types.ts";
import {
  candidateDecisionBody,
  currentDecisionId,
  withFixtureWorkspace,
  writeDecision,
} from "./support.ts";

test("record type guards reject invalid identity fields from real candidate and established scans", () =>
  withFixtureWorkspace("record-guard-identities", async (workspaceRoot) => {
    const candidateId = "use-record-guard-candidate.md";
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
    const scan = await scanDecisionRecords({ workspaceRoot });
    const candidate = scan.records.find(
      (record) => record.decisionId === candidateId,
    );
    const established = scan.records.find(
      (record) => record.decisionId === currentDecisionId,
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
    { ...record, sourcePath: "nested/invalid-path.md" },
  ];
}
