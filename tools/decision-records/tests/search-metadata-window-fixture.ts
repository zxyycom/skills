import assert from "node:assert/strict";
import type { IndexedDecisionState } from "../src/decision-query-contract.ts";
import { isDecisionSourcePath } from "../src/decision-path.ts";
import { listSnapshotEntries } from "./queries/snapshot-fixture.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  decisionIdForTest
} from "./support-record-fixture.ts";

export async function metadataEntries(
  count: number
): Promise<IndexedDecisionState[]> {
  const entries = await listSnapshotEntries();
  const template = entries.find(({ id }) => id === currentDecisionId);
  const archived = entries.find(({ id }) => id === archivedDecisionId);
  assert.ok(template && archived);
  return [
    archived,
    ...Array.from({ length: count }, (_, index) => {
      const name = `window-${String(index).padStart(4, "0")}`;
      const id = decisionIdForTest(`261021-${name}`);
      const sourcePath = `${id}.md`;
      assert.ok(isDecisionSourcePath(sourcePath));
      return {
        id,
        state: {
          ...template.state,
          name,
          sourcePath,
          title: "window-needle",
          relations: [
            {
              type: "修订" as const,
              target: archivedDecisionId,
              summary: "lineage detail"
            }
          ]
        }
      };
    }).reverse()
  ];
}
