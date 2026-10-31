import { assertLifecycleRejected } from "../../lifecycle/evolution/domain-support.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import { test } from "./support.ts";

test("set-relations maintains established decisions only", async () => {
  await assertLifecycleRejected(
    [{ id: "source" }, { id: "target", status: "archived" }],
    {
      action: "set-relations",
      preflight: false,
      relationOverrideGroups: [
        {
          source: decisionIdForTest("source"),
          relationOverride: {
            kind: "replace",
            relations: [{ target: decisionIdForTest("target"), type: "修订" }]
          }
        }
      ]
    },
    /set-relations maintains established decisions only/
  );
});

test("set-relations rejects a summary that misses the final relation set", async () => {
  await assertLifecycleRejected(
    [
      { id: "source", status: "active" },
      { id: "target", status: "archived" }
    ],
    {
      action: "set-relations",
      preflight: false,
      relationOverrideGroups: [
        {
          source: decisionIdForTest("source"),
          relationOverride: {
            kind: "replace",
            relations: [{ target: decisionIdForTest("target"), type: "修订" }],
            relationSummaries: [
              { target: decisionIdForTest("source"), summary: "失配说明" }
            ]
          }
        }
      ]
    },
    /relation-summary target is not in the complete relation set/
  );
});
