import test from "node:test";
import path from "node:path";
import { assertDomainPublishedWriterRejection } from "../../../record-operations/tests/transactions/domain-transaction-contract.ts";
import { setInvestigationRelations } from "../../src/relations/transactions/relation-transaction.ts";
import { writeCollection } from "../support/collection-support.ts";
import { investigationRoot } from "../support/fixture-support.ts";

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
