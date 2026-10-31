import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as publicApi from "../../../skills/test-evidence-review/scripts/test-evidence-catalog.ts";
import { fixture, type CliResult } from "./public-boundary-test-support.ts";

const publicCli = fileURLToPath(
  new URL(
    "../../../skills/test-evidence-review/scripts/test-evidence-catalog.ts",
    import.meta.url
  )
);

function json(result: CliResult): unknown {
  assert.notEqual(result.stdout, "", result.stderr);
  return JSON.parse(result.stdout);
}

async function writeIndex(root: string): Promise<void> {
  const result = await publicApi.syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write"
  });
  v.parse(publicApi.testEvidenceSyncResultSchema, result);
  assert.equal(result.status, "ok", JSON.stringify(result));
}

test("distributed TS imports in Node without running CLI output and exposes the current public API", async (context) => {
  const { node } = await fixture(context);
  const program = [
    `const module = await import(${JSON.stringify(pathToFileURL(publicCli).href)});`,
    "process.stdout.write(JSON.stringify(Object.keys(module).sort()));"
  ].join("\n");
  const result = await node.run(["--input-type=module", "--eval", program]);
  if (result === null) return;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  const exports: unknown = JSON.parse(result.stdout);
  assert.deepEqual(exports, [
    "expectedSourceSchema",
    "fingerprintSchema",
    "listTestEvidenceTags",
    "queryLimitSchema",
    "queryOffsetSchema",
    "queryTestEvidence",
    "runTestEvidenceCatalogCli",
    "searchTestEvidence",
    "showTestEvidenceCase",
    "snapshotSchema",
    "stageTestEvidenceIndex",
    "syncTestEvidenceIndex",
    "testEvidenceCaseIdPatternSource",
    "testEvidenceCaseIdSchema",
    "testEvidenceCaseIndexStateSchema",
    "testEvidenceCaseSchema",
    "testEvidenceCasesPath",
    "testEvidenceDefinitionVersion",
    "testEvidenceDiagnosticSchema",
    "testEvidenceIndexMetadataSchema",
    "testEvidenceIndexPath",
    "testEvidenceNamespace",
    "testEvidencePath",
    "testEvidenceQueryResultSchema",
    "testEvidenceReferenceResultSchema",
    "testEvidenceReportSchema",
    "testEvidenceSchemaVersion",
    "testEvidenceSearchResultSchema",
    "testEvidenceShowResultSchema",
    "testEvidenceStageResultSchema",
    "testEvidenceStateIndexSchema",
    "testEvidenceSyncResultSchema",
    "testEvidenceTagSchema",
    "testEvidenceTagsResultSchema",
    "testEvidenceTestIdSchema",
    "validateTestEvidence",
    "validateTestEvidenceReferences"
  ]);
  for (const callable of [
    "listTestEvidenceTags",
    "queryTestEvidence",
    "searchTestEvidence",
    "showTestEvidenceCase",
    "stageTestEvidenceIndex",
    "syncTestEvidenceIndex",
    "validateTestEvidence",
    "validateTestEvidenceReferences"
  ] as const)
    assert.equal(typeof publicApi[callable], "function");
});

test("distributed Node CLI returns schema-valid filtered Case list JSON", async (context) => {
  const { root, node } = await fixture(context);
  await writeIndex(root);
  const list = await node.run([
    publicCli,
    "--json",
    "list",
    "--tag",
    "alpha",
    "--test",
    "test:shared",
    "--limit",
    "1",
    "--offset",
    "0"
  ]);
  if (list === null) return;
  assert.equal(list.code, 0, list.stderr);
  const listed = v.parse(publicApi.testEvidenceQueryResultSchema, json(list));
  assert.deepEqual(
    listed.cases.map((entry) => entry.id),
    ["PUBLIC-BOUNDARY-ALPHA-001"]
  );
});

test("distributed Node CLI returns schema-valid Case tag counts JSON", async (context) => {
  const { root, node } = await fixture(context);
  await writeIndex(root);
  const tags = await node.run([publicCli, "--json", "tags"]);
  if (tags === null) return;
  assert.equal(tags.code, 0, tags.stderr);
  const tagged = v.parse(publicApi.testEvidenceTagsResultSchema, json(tags));
  assert.deepEqual(tagged.tags, [
    { caseCount: 2, tag: "alpha" },
    { caseCount: 1, tag: "beta" }
  ]);
});

test("distributed Node CLI returns schema-valid authoritative Case show JSON", async (context) => {
  const { root, node } = await fixture(context);
  await writeIndex(root);
  const shown = await node.run([
    publicCli,
    "--json",
    "show",
    "PUBLIC-BOUNDARY-ALPHA-001"
  ]);
  if (shown === null) return;
  assert.equal(shown.code, 0, shown.stderr);
  const showed = v.parse(publicApi.testEvidenceShowResultSchema, json(shown));
  assert.match(
    showed.markdown ?? assert.fail("show must return authoritative Markdown"),
    /alpha Case/u
  );
});

test("distributed Node CLI returns schema-valid filtered Case search JSON", async (context) => {
  const { root, node } = await fixture(context);
  await writeIndex(root);
  const searched = await node.run([
    publicCli,
    "--json",
    "search",
    "authoritative needle",
    "--tag",
    "beta"
  ]);
  if (searched === null) return;
  assert.equal(searched.code, 0, searched.stderr);
  const search = v.parse(
    publicApi.testEvidenceSearchResultSchema,
    json(searched)
  );
  assert.deepEqual(
    search.cases.map((entry) => entry.id),
    ["PUBLIC-BOUNDARY-BETA-001"]
  );
});

test("distributed sync requires --write before creating the Case index", async (context) => {
  const { root, node } = await fixture(context);
  const index = path.join(root, "docs/test-evidence/test-evidence-index.json");
  const checked = await node.run([publicCli, "--json", "sync-index"]);
  if (checked === null) return;
  assert.equal(checked.code, 1, checked.stderr);
  v.parse(publicApi.testEvidenceSyncResultSchema, json(checked));
  await assert.rejects(fs.access(index));

  const written = await node.run([
    publicCli,
    "--json",
    "sync-index",
    "--write"
  ]);
  if (written === null) return;
  assert.equal(written.code, 0, written.stderr);
  v.parse(publicApi.testEvidenceSyncResultSchema, json(written));
  await fs.access(index);
});

test("distributed stage CLI help preserves variadic Case arguments", async (context) => {
  const { node } = await fixture(context);
  const help = await node.run([publicCli, "stage-index", "--help"]);
  if (help === null) return;
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /stage-index \[options\] <case-ids\.\.\.>/u);
});

test("distributed stage CLI reports malformed Case IDs as usage failures", async (context) => {
  const { node } = await fixture(context);
  const malformed = await node.run([
    publicCli,
    "--json",
    "stage-index",
    "not-a-case-id"
  ]);
  if (malformed === null) return;
  assert.equal(malformed.code, 2, malformed.stderr);
  assert.equal(malformed.stdout, "");
  assert.match(malformed.stderr, /error:/u);
});

test("distributed stage CLI reports missing Case IDs as JSON domain failures", async (context) => {
  const { root, node } = await fixture(context);
  await writeIndex(root);
  const missing = await node.run([
    publicCli,
    "--json",
    "stage-index",
    "PUBLIC-BOUNDARY-MISSING-001"
  ]);
  if (missing === null) return;
  assert.equal(missing.code, 1, missing.stderr);
  assert.equal(missing.stderr, "");
  const failure = v.parse(
    publicApi.testEvidenceStageResultSchema,
    json(missing)
  );
  assert.equal(failure.status, "error");
});

test("distributed Node CLI writes usage failures only to stderr with exit two", async (context) => {
  const { node } = await fixture(context);
  const result = await node.run([publicCli, "--json", "list", "--unknown"]);
  if (result === null) return;
  assert.equal(result.code, 2, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /error: unknown option '--unknown'/u);
});

test("public query API returns schema-valid diagnostics for invalid options", async (context) => {
  const { root } = await fixture(context);
  await writeIndex(root);
  const invalid = await publicApi.queryTestEvidence({
    limit: 0,
    workspaceRoot: root
  });
  v.parse(publicApi.testEvidenceQueryResultSchema, invalid);
  assert.ok(
    invalid.diagnostics.some(
      (diagnostic: { code: string }) =>
        diagnostic.code === "query.options-invalid"
    )
  );
});

test("Case query and explicit sync operate without project configuration or an entity snapshot", async (context) => {
  const { root, node } = await fixture(context);
  for (const missing of [
    "package.json",
    "docs/test-evidence/test-entity-index.json",
    ".test-evidence.json"
  ])
    await assert.rejects(fs.access(path.join(root, missing)));
  await writeIndex(root);
  const list = await node.run([publicCli, "--json", "list"]);
  if (list === null) return;
  assert.equal(list.code, 0, list.stderr);
  const result = v.parse(publicApi.testEvidenceQueryResultSchema, json(list));
  assert.equal(result.total, 2);
});

test("Node smoke cleanup closes a live child before completing and prevents subsequent starts", async (context) => {
  const { root, node } = await fixture(context);
  const ready = Promise.withResolvers<void>();
  let output = "";
  const running = node.run(
    [
      "--eval",
      "process.stdout.write(`${process.pid}\\n`); setInterval(() => {}, 1000);"
    ],
    (chunk) => {
      output += chunk;
      if (output.includes("\n")) ready.resolve();
    }
  );
  await ready.promise;
  await node.close();
  const pid = Number(output.trim());
  assert.ok(Number.isSafeInteger(pid) && pid > 0, output);
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  assert.equal(await running, null);
  const marker = path.join(root, "unexpected-start.txt");
  assert.equal(
    await node.run([
      "--eval",
      `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "started");`
    ]),
    null
  );
  await assert.rejects(fs.access(marker));
});
