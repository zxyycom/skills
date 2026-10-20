import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareCandidateCreate } from "../src/candidate-creation-input.ts";

const candidateInput = {
  formedAt: "2026-09-02T12:00:00+00:00",
  id: "candidate-topic",
  question: "候选是否在建立前保持集合外？",
  relations: [],
  tags: ["candidate", "investigation-report"],
  title: "候选调查",
  workspaceRoot: "/workspace"
} as const;

test("candidate API defaults formedAt exactly once and preserves explicit timestamp validation", () => {
  const defaultInput = {
    id: candidateInput.id,
    question: candidateInput.question,
    relations: candidateInput.relations,
    tags: candidateInput.tags,
    title: candidateInput.title,
    workspaceRoot: candidateInput.workspaceRoot
  };
  let currentTimestampCalls = 0;
  const defaulted = prepareCandidateCreate(defaultInput, () => {
    currentTimestampCalls += 1;
    return "2026-09-03T00:00:01Z";
  });
  assert.equal(defaulted.isOk(), true);
  if (defaulted.isErr()) assert.fail(defaulted.error.join("\n"));
  assert.equal(currentTimestampCalls, 1);
  assert.equal(defaulted.value.candidate.formedAt, "2026-09-03T00:00:01Z");
  assert.equal(defaulted.value.candidate.id, "260903-candidate-topic");

  const explicit = prepareCandidateCreate(candidateInput, () =>
    assert.fail("an explicit formedAt must not read the current time")
  );
  assert.equal(explicit.isOk(), true);
  if (explicit.isErr()) assert.fail(explicit.error.join("\n"));
  assert.equal(explicit.value.candidate.formedAt, candidateInput.formedAt);
  assert.equal(explicit.value.candidate.id, "260902-candidate-topic");

  const malformed = prepareCandidateCreate(
    { ...candidateInput, formedAt: "2026-09-03" },
    () => assert.fail("a malformed explicit formedAt must not use a default")
  );
  assert.equal(malformed.isErr(), true);
});
