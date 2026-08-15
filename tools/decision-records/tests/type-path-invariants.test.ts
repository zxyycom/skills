import assert from "node:assert/strict";
import test from "node:test";
import {
  decisionIdFromSourcePath,
  isDecisionId,
  isDecisionSourcePath,
  isDecisionTag,
  sourcePathForDecision,
} from "../src/decision-path.ts";
import { decisionSourceRevision } from "../src/decision-state-index.ts";
import type { DecisionIndexMetadata } from "../src/types.ts";

const emptyDecisionIndexMetadata: DecisionIndexMetadata = {};
// @ts-expect-error Decision index metadata has no supported non-empty fields.
const nonEmptyDecisionIndexMetadata: DecisionIndexMetadata = { legacy: true };
void emptyDecisionIndexMetadata;
void nonEmptyDecisionIndexMetadata;

test("decision types and paths preserve stable ID tag and sourcePath invariants", () => {
  assert.equal(isDecisionId("use-semantic-paths.md"), true);
  assert.equal(isDecisionId("archive/use-semantic-paths.md"), false);
  assert.equal(isDecisionId("invalid_name.md"), false);
  assert.equal(isDecisionTag("decision-records"), true);
  assert.equal(isDecisionTag("decision_records"), false);
  assert.equal(isDecisionSourcePath("use-semantic-paths.md"), true);
  assert.equal(isDecisionSourcePath("archive/use-semantic-paths.md"), true);
  assert.equal(isDecisionSourcePath("legacy/use-semantic-paths.md"), false);
  assert.equal(
    decisionIdFromSourcePath("archive/use-semantic-paths.md"),
    "use-semantic-paths.md",
  );
  assert.equal(
    sourcePathForDecision("use-semantic-paths.md", "archived"),
    "archive/use-semantic-paths.md",
  );

  const sourceRevision = decisionSourceRevision([
    { decisionId: "use-a.md", sourcePath: "use-a.md", text: "a\n" },
    { decisionId: "use-b.md", sourcePath: "archive/use-b.md", text: "b\n" },
  ]);
  assert.deepEqual(Object.keys(sourceRevision.entries), [
    "use-a.md",
    "use-b.md",
  ]);
  assert.notEqual(
    decisionSourceRevision([
      { decisionId: "use-a.md", sourcePath: "archive/use-a.md", text: "a\n" },
      { decisionId: "use-b.md", sourcePath: "archive/use-b.md", text: "b\n" },
    ]).entries["use-a.md"],
    sourceRevision.entries["use-a.md"],
  );
});
