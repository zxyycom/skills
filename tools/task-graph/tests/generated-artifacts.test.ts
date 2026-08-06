import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { toJsonSchema } from "@valibot/to-json-schema";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as sourceApi from "../src/cli.ts";
import { graphIndex, taskOperation } from "./helpers.ts";
import {
  taskGraphJsonSchemaOverrideAction,
  taskIndexSchema
} from "../src/schema.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const generatedScriptPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph.mjs"
);
const generatedDeclarationPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph.d.mts"
);
const generatedSchemaPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "references",
  "task-graph-index.schema.json"
);

const publicRuntimeExports = [
  "TaskGraphError",
  "TaskGraphService",
  "applyTaskGraphOperations",
  "cancelTask",
  "claimTask",
  "closeScopes",
  "completeTask",
  "createTaskGraphService",
  "defaultTaskGraphIndexPath",
  "emptyTaskIndex",
  "failTask",
  "parseTaskGraphApplyRequest",
  "parseTaskIndex",
  "projectScope",
  "queryScopeGc",
  "recoverTask",
  "releaseTask",
  "renewTaskLease",
  "retryTask",
  "runTaskGraphCli",
  "scopeCloseProjection",
  "serializeTaskIndex",
  "taskControlModes",
  "taskEffectiveStates",
  "taskExecutionPhases",
  "taskGraphSchemaVersion",
  "taskGraphVersion",
  "validateTaskIndexGraph"
] as const;

test("generated distribution matches source API, schema bytes, and portable metadata", async () => {
  const generatedApi = await import(pathToFileURL(generatedScriptPath).href);
  assert.deepEqual(Object.keys(sourceApi).sort(), [...publicRuntimeExports]);
  assert.deepEqual(Object.keys(generatedApi).sort(), [...publicRuntimeExports]);

  const sourceOutput: string[] = [];
  const generatedOutput: string[] = [];
  const sourceExit = await sourceApi.runTaskGraphCli(["--version"], {
    io: { stdout: (text) => sourceOutput.push(text) }
  });
  const generatedRunner = generatedApi.runTaskGraphCli as typeof sourceApi.runTaskGraphCli;
  const generatedExit = await generatedRunner(["--version"], {
    io: { stdout: (text) => generatedOutput.push(text) }
  });
  assert.equal(generatedExit, sourceExit);
  assert.deepEqual(generatedOutput, sourceOutput);

  const script = await fs.readFile(generatedScriptPath, "utf8");
  assert.match(
    script,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/task-graph\/src\/cli\.ts/u
  );
  assert.match(script, /Rebuild: bun run sync:task-graph-cli/u);
  assert.match(script, /sourceMappingURL=task-graph\.mjs\.map/u);

  const declaration = await fs.readFile(generatedDeclarationPath, "utf8");
  for (const exportedName of publicRuntimeExports) {
    assert.match(declaration, new RegExp(`\\b${exportedName}\\b`, "u"));
  }
  for (const publicType of [
    "TaskMutationPrecondition",
    "CompleteTaskOptions",
    "CancelTaskOptions",
    "RecoverTaskOptions",
    "TaskGraphApplyRequest",
    "ScopeProjection",
    "TaskGraphServiceOptions",
    "TaskGraphCliOptions"
  ]) {
    assert.match(declaration, new RegExp(`export type ${publicType}\\b`, "u"));
  }
  for (const internalName of [
    "TaskGraphStore",
    "TaskGraphStoreHooks",
    "TaskGraphStoreOptions",
    "createTaskGraphStore",
    "IdGenerator",
    "hooks",
    "idGenerator",
    "leaseIdGenerator",
    "processState"
  ]) {
    assert.doesNotMatch(declaration, new RegExp(`\\b${internalName}\\b`, "u"));
  }

  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedScriptPath}.map`, "utf8")
  ) as { sourceRoot: string; sources: string[] };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/task-graph/src/cli.ts"));
  assert.ok(sourceMap.sources.every((source) =>
    !path.isAbsolute(source) && !source.includes("\\")
  ));

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
      "Safe-integer ID suffixes, real RFC 3339 instants, cross-field, topology, "
      + "revision, lease, and canonical-form invariants are validated by the "
      + "task-graph CLI check command.",
    title: "TaskGraphIndex"
  };
  assert.equal(
    await fs.readFile(generatedSchemaPath, "utf8"),
    `${JSON.stringify(expectedSchema, null, 2)}\n`
  );

  const consumerSchema = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  ) as object;
  const validateConsumer = new Ajv2020({ allErrors: true, strict: false }).compile(
    consumerSchema
  );
  const validIndex = graphIndex([taskOperation("consumer")]);
  validIndex.scopes["scope-000001"]!.bindings = Object.fromEntries([
    ["thread", "supported"]
  ]);
  validIndex.scopes["scope-000001"]!.tasks["task-000001"]!.content.references =
    Object.fromEntries([["source", "supported"]]);
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(validateConsumer(validIndex), true, JSON.stringify(validateConsumer.errors));

  const title = validIndex.scopes["scope-000001"]!.tasks["task-000001"]!.content;
  title.title = "😀".repeat(120);
  assert.doesNotThrow(() => sourceApi.parseTaskIndex(validIndex));
  assert.equal(validateConsumer(validIndex), true, JSON.stringify(validateConsumer.errors));

  for (const invalidTitle of [
    "",
    "x".repeat(121),
    "😀".repeat(121),
    "line one\nline two",
    " leading",
    "trailing "
  ]) {
    const invalid = structuredClone(validIndex);
    invalid.scopes["scope-000001"]!.tasks["task-000001"]!.content.title = invalidTitle;
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, invalidTitle);
  }

  for (const [sourceId, zeroId] of [
    ["scope-000001", "scope-000000"],
    ["task-000001", "task-000000"]
  ] as const) {
    const invalid = structuredClone(validIndex);
    if (sourceId.startsWith("scope-")) {
      invalid.scopes[zeroId] = invalid.scopes[sourceId]!;
      delete invalid.scopes[sourceId];
    } else {
      const tasks = invalid.scopes["scope-000001"]!.tasks;
      tasks[zeroId] = tasks[sourceId]!;
      delete tasks[sourceId];
    }
    assert.throws(() => sourceApi.parseTaskIndex(invalid));
    assert.equal(validateConsumer(invalid), false, zeroId);
  }

  const longScopeKey = structuredClone(validIndex);
  longScopeKey.scopes["scope-000001"]!.key = "x".repeat(81);
  assert.throws(() => sourceApi.parseTaskIndex(longScopeKey));
  assert.equal(validateConsumer(longScopeKey), false);

  for (const dictionaryKind of ["binding", "reference"] as const) {
    const longDictionaryKey = structuredClone(validIndex);
    const dictionary = Object.fromEntries([["a".repeat(81), "too long"]]);
    if (dictionaryKind === "binding") {
      longDictionaryKey.scopes["scope-000001"]!.bindings = dictionary;
    } else {
      longDictionaryKey.scopes["scope-000001"]!.tasks["task-000001"]!
        .content.references = dictionary;
    }
    assert.throws(() => sourceApi.parseTaskIndex(longDictionaryKey));
    assert.equal(validateConsumer(longDictionaryKey), false, dictionaryKind);
  }

  for (const reservedKey of ["constructor", "prototype", "__proto__"]) {
    const prototypeKey = structuredClone(validIndex);
    prototypeKey.scopes["scope-000001"]!.bindings = Object.fromEntries([
      [reservedKey, "blocked"]
    ]);
    assert.throws(() => sourceApi.parseTaskIndex(prototypeKey));
    assert.equal(validateConsumer(prototypeKey), false, reservedKey);
  }
});
