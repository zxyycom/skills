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
  "Investigation shared transaction verifies bytes mode and commit before success",
  assertRecordWriteReadback
);
test(
  "Investigation shared transaction preflight avoids locks and unchanged verifies fresh facts",
  assertRecordPreflightAndUnchanged
);
test(
  "Investigation shared transaction restores only actual precommit writes",
  assertRecordActualWriteRecovery
);
test(
  "Investigation shared transaction protects later bytes inode mode and unwritten members",
  assertRecordRecoveryWinnerProtection
);
test(
  "Investigation shared transaction retains committed verification and cleanup failures separately",
  assertRecordCommittedVerificationFailure
);
test(
  "Investigation shared transaction recognizes a rejected writer that published the index",
  assertRecordRejectedPublishedWriter
);
test(
  "Investigation shared candidate commit preserves creation and distinguishes cleanup only",
  assertRecordCandidateCommitAndCleanup
);
test(
  "Investigation shared transaction never overwrites a recreated old path",
  assertRecordOldPathWinnerProtection
);

import path from "node:path";
import { assertDomainPublishedWriterRejection } from "../../record-operations/tests/domain-transaction-contract.ts";
import { setInvestigationRelations } from "../src/relation-transaction.ts";
import { writeCollection } from "./collection-support.ts";
import { investigationRoot } from "./fixture-support.ts";

test("Investigation actual domain adapter satisfies the shared committed writer rejection contract", async () => {
  await assertDomainPublishedWriterRejection(async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [{ id: "base" }, { id: "next" }]);
    const root = investigationRoot(workspaceRoot);
    return {
      sourcePath: path.join(root, "next.md"),
      indexPath: path.join(root, "investigation-index.json"),
      apply: async () => {
        const result = await setInvestigationRelations({
          workspaceRoot,
          replacements: [
            { source: "next", relations: [{ type: "补充", target: "base" }] }
          ]
        });
        return {
          failed: result.errors.length > 0,
          changed: result.changed,
          outcome: result.mutation?.outcome,
          review: result.relationReview
        };
      }
    };
  });
});

import { assertRecordWriteHandleOwnership } from "../../record-operations/tests/transaction-contract.ts";
test(
  "Investigation shared recovery never claims a replacement inode between writer close and readback",
  assertRecordWriteHandleOwnership
);

import { assertRecordCreationModeProof } from "../../record-operations/tests/transaction-creation-contract.ts";
test(
  "Investigation shared native creation binds permission verification and recovery to its actual handle",
  assertRecordCreationModeProof
);
