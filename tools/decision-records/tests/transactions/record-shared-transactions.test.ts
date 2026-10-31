import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { assertDomainPublishedWriterRejection } from "../../../record-operations/tests/transactions/domain-transaction-contract.ts";
import { applyPreparedDecisionTransaction } from "../../src/transactions/decision-transaction.ts";
import { scanDecisionRecords } from "../../src/scan/scan.ts";
import { a, fixture } from "../support/support-local-contracts.ts";
import { decisionFilePath } from "../support/support.ts";

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
