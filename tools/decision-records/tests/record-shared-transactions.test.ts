import test from "node:test";
import {
  assertRecordWriteReadback,
  assertRecordPreflightAndUnchanged,
  assertRecordActualWriteRecovery,
  assertRecordRecoveryWinnerProtection,
  assertRecordCommittedVerificationFailure,
  assertRecordRejectedPublishedWriter,
  assertRecordCandidateCommitAndCleanup,
  assertRecordOldPathWinnerProtection
} from "../../record-operations/tests/transaction-contract.ts";

test(
  "Decision shared transaction verifies bytes mode and commit before success",
  assertRecordWriteReadback
);
test(
  "Decision shared transaction preflight avoids locks and unchanged verifies fresh facts",
  assertRecordPreflightAndUnchanged
);
test(
  "Decision shared transaction restores only actual precommit writes",
  assertRecordActualWriteRecovery
);
test(
  "Decision shared transaction protects later bytes inode mode and unwritten members",
  assertRecordRecoveryWinnerProtection
);
test(
  "Decision shared transaction retains committed verification and cleanup failures separately",
  assertRecordCommittedVerificationFailure
);
test(
  "Decision shared transaction recognizes a rejected writer that published the index",
  assertRecordRejectedPublishedWriter
);
test(
  "Decision shared candidate commit preserves creation and distinguishes cleanup only",
  assertRecordCandidateCommitAndCleanup
);
test(
  "Decision shared transaction never overwrites a recreated old path",
  assertRecordOldPathWinnerProtection
);

import fs from "node:fs/promises";
import path from "node:path";
import { assertDomainPublishedWriterRejection } from "../../record-operations/tests/domain-transaction-contract.ts";
import { applyPreparedDecisionTransaction } from "../src/decision-transaction.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import { a, fixture } from "./support-local-contracts.ts";
import { decisionFilePath } from "./support.ts";

test("Decision actual domain adapter satisfies the shared committed writer rejection contract", async () => {
  await assertDomainPublishedWriterRejection(async (root) => {
    await fixture(root);
    const sourcePath = decisionFilePath(root, a);
    const expectedText = await fs.readFile(sourcePath, "utf8");
    return {
      sourcePath,
      indexPath: path.join(root, "docs/decisions/decision-index.json"),
      apply: async () => {
        const result = await applyPreparedDecisionTransaction({
          context: await scanDecisionRecords({ workspaceRoot: root }),
          changes: [
            {
              decisionPath: sourcePath,
              expectedText,
              nextText: expectedText.replace("原始 A", "已更正 A")
            }
          ]
        });
        return {
          failed: result.status === "error",
          changed: result.changed === true,
          outcome: result.status === "error" ? result.outcome : undefined,
          review: undefined
        };
      }
    };
  });
});

import { assertRecordWriteHandleOwnership } from "../../record-operations/tests/transaction-contract.ts";
test(
  "Decision shared recovery never claims a replacement inode between writer close and readback",
  assertRecordWriteHandleOwnership
);

import { assertRecordCreationModeProof } from "../../record-operations/tests/transaction-creation-contract.ts";
test(
  "Decision shared native creation binds permission verification and recovery to its actual handle",
  assertRecordCreationModeProof
);

import {
  assertRecordPhaseVerificationReuse,
  assertRecordPhaseExpectedFactProtection,
  assertRecordPostPhaseDriftProtection
} from "../../record-operations/tests/transaction-verification-contract.ts";
test(
  "Decision shared verification acquires overlapping unchanged protection once in each independent phase",
  assertRecordPhaseVerificationReuse
);
test(
  "Decision shared verification never reuses different namespace or expected snapshot facts",
  assertRecordPhaseExpectedFactProtection
);

test(
  "Decision shared postwrite verification rejects later bytes mode and inode despite overlapping fresh protection",
  assertRecordPostPhaseDriftProtection
);
