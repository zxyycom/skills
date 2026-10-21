import { createCliProgram } from "../../src/cli-args.ts";
import { listSnapshotEntries, listProjection } from "./domain-support.ts";
import type { DecisionListStatus } from "../../src/types.ts";
import { assert, currentDecisionId, test } from "./support.ts";

test("decision list defaults to active records without archived results", async () => {
  let status: DecisionListStatus | undefined;
  const parser = createCliProgram(
    async (args) => {
      assert.equal(args.command, "list");
      if (args.command === "list") status = args.status;
      return 0;
    },
    () => {}
  );
  await parser.parseAsync(["node", "decision-records.ts", "list"]);
  assert.equal(status, "active");
  const result = listProjection(await listSnapshotEntries(), { status });
  assert.deepEqual(
    result.records.map((r) => r.decisionId),
    [currentDecisionId]
  );
  assert.ok(result.records.every((r) => r.status === "active"));
});
