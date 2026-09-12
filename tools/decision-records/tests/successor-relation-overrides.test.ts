import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { prepareSuccessors } from "../src/decision-relation-transaction-successors.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import type {
  DecisionRelation,
  DecisionRelationOverride
} from "../src/types.ts";
import {
  candidateDecisionBody,
  currentDecisionId,
  decisionFilePath,
  withFixtureWorkspace
} from "./support.ts";

test("successor relation overrides take precedence over transaction defaults", () =>
  withFixtureWorkspace(
    "successor-relation-overrides",
    async (workspaceRoot) => {
      const candidate = "local-relation-override";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, candidate),
        candidateDecisionBody({
          relations: [{ target: currentDecisionId, type: "修订" }]
        }),
        "utf8"
      );
      const scan = await scanDecisionRecords({ workspaceRoot });
      const record = scan.records.find((item) => item.decisionId === candidate);
      assert.ok(record);
      const requested = {
        alignment: "aligned" as const,
        decisionId: record.decisionId as typeof currentDecisionId
      };
      const transactionOverride = {
        kind: "replace" as const,
        relations: [{ target: currentDecisionId, type: "替代" as const }]
      };
      const variants: Array<{
        expected: DecisionRelation[];
        relationOverride: DecisionRelationOverride;
      }> = [
        {
          expected: [{ target: currentDecisionId, type: "修订" }],
          relationOverride: { kind: "source" }
        },
        { expected: [], relationOverride: { kind: "replace", relations: [] } },
        {
          expected: [{ target: currentDecisionId, type: "拆分" }],
          relationOverride: {
            kind: "replace",
            relations: [{ target: currentDecisionId, type: "拆分" }]
          }
        }
      ];
      for (const { relationOverride, expected } of variants) {
        const prepared = prepareSuccessors(
          scan,
          [{ ...requested, relationOverride }],
          transactionOverride,
          "2026-09-12T00:00:00Z",
          false
        );
        assert.equal(prepared.status, "ok");
        if (prepared.status === "ok") {
          assert.deepEqual(prepared.records[0]?.finalRelations, expected);
        }
      }
    }
  ));
