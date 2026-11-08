import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";

test("decision schema requires a nonempty name and explicit alignment", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL("../schemas/decision-index.schema.json", import.meta.url),
      "utf8"
    )
  );
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  const digest = `sha256:${"a".repeat(64)}`;
  const state = {
    name: "example",
    sourcePath: "240229-example.md",
    title: "Example",
    status: "active",
    alignment: "aligned",
    createdAt: "2024-02-29T00:00:00Z",
    purpose: "Purpose",
    background: "Background",
    decision: "Decision",
    tags: ["example"],
    relations: []
  };
  const index = (entry: unknown) => ({
    schemaVersion: 4,
    namespace: "decisions",
    definitionVersion: 11,
    metadata: {},
    sourceRevision: { metadata: digest, entries: { "240229-example": digest } },
    entries: { "240229-example": entry }
  });
  assert.equal(validate(index(state)), true);
  assert.equal(
    validate(index({ ...state, status: "archived", alignment: "unaligned" })),
    true
  );
  const { alignment: _alignment, ...withoutAlignment } = state;
  const { name: _name, ...withoutName } = state;
  for (const entry of [
    withoutAlignment,
    { ...state, alignment: null },
    withoutName,
    { ...state, name: "" }
  ])
    assert.equal(validate(index(entry)), false, JSON.stringify(entry));
});
