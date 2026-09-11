import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { toJsonSchema } from "@valibot/to-json-schema";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as sourceApi from "../src/cli.ts";
import { graphIndex, taskOperation } from "./helpers.ts";
import {
  taskGraphJsonSchemaOverrideAction,
  taskIndexSchema
} from "../src/schema.ts";

export async function assertDistributedSchema(
  generatedSchemaPath: string
): Promise<void> {
  const convertedSchema = toJsonSchema(taskIndexSchema, {
    errorMode: "ignore",
    overrideAction: taskGraphJsonSchemaOverrideAction,
    target: "draft-2020-12",
    typeMode: "input"
  });
  const expectedSchema = {
    ...convertedSchema,
    $id: "https://raw.githubusercontent.com/zxyycom/skills/main/skills/task-graph/references/task-graph-index.schema.json",
    $comment:
      "Safe-integer ID suffixes, real RFC 3339 instants, cross-field, topology, " +
      "revision, lease, and canonical-form invariants are validated by the " +
      "task-graph CLI info command.",
    title: "TaskGraphIndex"
  };
  assert.equal(
    await fs.readFile(generatedSchemaPath, "utf8"),
    `${JSON.stringify(expectedSchema, null, 2)}\n`
  );

  const consumerSchema = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  ) as object;
  const validateConsumer = new Ajv2020({
    allErrors: true,
    strict: false
  }).compile(consumerSchema);
  const validIndex = graphIndex([taskOperation("consumer")]);
  validIndex.tasks["task-000001"]!.content.references = Object.fromEntries([
    ["source", "supported"]
  ]);
  validIndex.tasks["task-000001"]!.content.acceptance = [];
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(
    validateConsumer(validIndex),
    true,
    JSON.stringify(validateConsumer.errors)
  );

  const title = validIndex.tasks["task-000001"]!.content;
  title.title = "😀".repeat(120);
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(
    validateConsumer(validIndex),
    true,
    JSON.stringify(validateConsumer.errors)
  );

  for (const invalidTitle of [
    "",
    "x".repeat(121),
    "😀".repeat(121),
    "line one\nline two",
    " leading",
    "trailing "
  ]) {
    const invalid = structuredClone(validIndex);
    invalid.tasks["task-000001"]!.content.title = invalidTitle;
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, invalidTitle);
  }

  for (const invalidTextField of ["title", "reference"] as const) {
    const invalid = structuredClone(validIndex);
    if (invalidTextField === "title") {
      (
        invalid.tasks["task-000001"]!.content as {
          title: unknown;
        }
      ).title = 42;
    } else {
      (
        invalid.tasks["task-000001"]!.content.references as Record<
          string,
          unknown
        >
      ).source = 42;
    }
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, invalidTextField);
  }

  for (const [sourceId, zeroId] of [["task-000001", "task-000000"]] as const) {
    const invalid = structuredClone(validIndex);
    invalid.tasks[zeroId] = invalid.tasks[sourceId]!;
    delete invalid.tasks[sourceId];
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, zeroId);
  }

  const longDictionaryKey = structuredClone(validIndex);
  longDictionaryKey.tasks["task-000001"]!.content.references =
    Object.fromEntries([["a".repeat(81), "too long"]]);
  assert.throws(() => sourceApi.parseTaskIndex(longDictionaryKey));
  assert.equal(validateConsumer(longDictionaryKey), false);

  for (const reservedKey of ["constructor", "prototype", "__proto__"]) {
    const prototypeKey = structuredClone(validIndex);
    prototypeKey.tasks["task-000001"]!.content.references = Object.fromEntries([
      [reservedKey, "blocked"]
    ]);
    assert.throws(() => sourceApi.parseTaskIndex(prototypeKey));
    assert.equal(validateConsumer(prototypeKey), false, reservedKey);
  }
}
