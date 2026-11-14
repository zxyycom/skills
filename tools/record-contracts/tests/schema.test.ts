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

test("resource schemas enforce record and index structure", () => {
  const recordSchema = JSON.parse(
    readFileSync(
      new URL("../schemas/resource-record.schema.json", import.meta.url),
      "utf8"
    )
  );
  const indexSchema = JSON.parse(
    readFileSync(
      new URL("../schemas/resource-index.schema.json", import.meta.url),
      "utf8"
    )
  );
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addSchema(recordSchema);
  const record = ajv.getSchema(recordSchema.$id)!;
  const index = ajv.compile(indexSchema);
  const collection = {
    schemaVersion: 1,
    kind: "collection",
    id: "root",
    title: "集合"
  };
  const file = {
    id: "main",
    role: "primary",
    sha256: null,
    locations: [],
    gap: "未保存"
  };
  const resource = {
    schemaVersion: 1,
    kind: "resource",
    id: "item",
    title: "资源",
    collection: "root",
    versions: [{ id: "v1", files: [file], members: [] }]
  };
  assert.equal(record(collection), true, JSON.stringify(record.errors));
  assert.equal(record(resource), true, JSON.stringify(record.errors));
  assert.equal(
    index({
      schemaVersion: 1,
      records: [
        {
          sourcePath: "resources/records/item.md",
          sourceRevision: `sha256:${"a".repeat(64)}`,
          record: resource
        }
      ]
    }),
    true,
    JSON.stringify(index.errors)
  );
  for (const invalid of [
    { ...resource, versions: [] },
    { ...resource, versions: [{ id: "v1", files: [], members: [] }] },
    {
      ...resource,
      versions: [
        { id: "v1", files: [{ ...file, gap: undefined }], members: [] }
      ]
    },
    {
      ...resource,
      versions: [{ id: "v1", files: [{ ...file, role: "other" }], members: [] }]
    },
    { ...collection, parent: "bad/id" }
  ])
    assert.equal(record(invalid), false, JSON.stringify(invalid));
});

test("resource schema distinguishes input evidence and version references", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL("../schemas/resource-record.schema.json", import.meta.url),
      "utf8"
    )
  );
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  const input = {
    type: "input",
    target: { record: { resource: "base", version: "v1", member: "main" } },
    evidence: { path: "calls.md", locator: "run" },
    scope: "input",
    order: 1
  };
  const make = (relation: unknown, parents: unknown[] = []) => ({
    schemaVersion: 1,
    kind: "resource",
    id: "item",
    title: "Item",
    collection: "root",
    versions: [
      {
        id: "v1",
        files: [
          {
            id: "main",
            role: "primary",
            sha256: null,
            locations: [],
            gap: "missing",
            relations: [relation]
          }
        ],
        members: [],
        parents
      }
    ]
  });
  assert.equal(
    validate(make(input, [{ resource: "base", version: "v1" }])),
    true,
    JSON.stringify(validate.errors)
  );
  for (const invalid of [
    make({ ...input, order: 0 }),
    make({ ...input, evidence: { path: "calls.md" } }),
    make({ ...input, target: { record: { resource: "base", version: "v1" } } }),
    make({
      ...input,
      target: { unknown: "missing", evidence: { path: "note.md" } }
    }),
    make({ ...input, type: "reference" }),
    make(input, [{ resource: "base", version: "v1", member: "main" }])
  ])
    assert.equal(validate(invalid), false, JSON.stringify(invalid));
  const reference = {
    ...input,
    type: "reference",
    target: { unknown: "not registered" }
  };
  const { order: _order, ...withoutOrder } = reference;
  assert.equal(
    validate(make(withoutOrder)),
    true,
    JSON.stringify(validate.errors)
  );
});
