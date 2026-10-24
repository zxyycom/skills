import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import * as v from "valibot";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as publicApi from "../../../skills/test-evidence-review/scripts/test-evidence-catalog.ts";

const publicCli = fileURLToPath(
  new URL(
    "../../../skills/test-evidence-review/scripts/test-evidence-catalog.ts",
    import.meta.url
  )
);

type CliResult = Readonly<{
  code: number | null;
  stderr: string;
  stdout: string;
}>;

async function runNode(
  root: string,
  args: readonly string[]
): Promise<CliResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn("node", [...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    let failure: Error | undefined;
    child.once("error", (error) => {
      failure = error;
    });
    child.once("close", (code) => {
      if (failure !== undefined) reject(failure);
      else resolve({ code, stderr, stdout });
    });
  });
}

function json(result: CliResult): unknown {
  assert.notEqual(result.stdout, "", result.stderr);
  return JSON.parse(result.stdout);
}

async function fixture(context: TestContext): Promise<string> {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-public-")
  );
  context.after(() => fs.rm(parent, { force: true, recursive: true }));
  const root = path.join(parent, "workspace");
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await fs.writeFile(
    path.join(cases, "alpha.md"),
    "### Case PUBLIC-BOUNDARY-ALPHA-001: alpha Case\n\nTests:\n- `test:alpha`\n- `test:shared`\n\nTags:\n- `alpha`\n\nContract:\n- alpha remains queryable\n\nProves:\n- alpha is returned by exact filters\n"
  );
  await fs.writeFile(
    path.join(cases, "beta.md"),
    "### Case PUBLIC-BOUNDARY-BETA-001: beta Case\n\nTests:\n- `test:beta`\n- `test:shared`\n\nTags:\n- `alpha`\n- `beta`\n\nContract:\n- authoritative needle stays searchable\n\nProves:\n- search returns the authoritative Case body\n"
  );
  return root;
}

async function writeIndex(root: string): Promise<void> {
  const result = await runNode(root, [
    publicCli,
    "--json",
    "sync-index",
    "--write"
  ]);
  assert.equal(result.code, 0, result.stderr);
  v.parse(publicApi.testEvidenceSyncResultSchema, json(result));
}

test("distributed TS imports in Node without running CLI output and exposes the current public API", async (context) => {
  const root = await fixture(context);
  const program = [
    `const module = await import(${JSON.stringify(pathToFileURL(publicCli).href)});`,
    "process.stdout.write(JSON.stringify(Object.keys(module).sort()));"
  ].join("\n");
  const result = await runNode(root, [
    "--input-type=module",
    "--eval",
    program
  ]);
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

test("distributed Node CLI returns schema-valid Case list, tags, show, and search JSON", async (context) => {
  const root = await fixture(context);
  await writeIndex(root);
  const list = await runNode(root, [
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
  assert.equal(list.code, 0, list.stderr);
  const listed = v.parse(publicApi.testEvidenceQueryResultSchema, json(list));
  assert.deepEqual(
    listed.cases.map((entry) => entry.id),
    ["PUBLIC-BOUNDARY-ALPHA-001"]
  );

  const tags = await runNode(root, [publicCli, "--json", "tags"]);
  assert.equal(tags.code, 0, tags.stderr);
  const tagged = v.parse(publicApi.testEvidenceTagsResultSchema, json(tags));
  assert.deepEqual(tagged.tags, [
    { caseCount: 2, tag: "alpha" },
    { caseCount: 1, tag: "beta" }
  ]);

  const shown = await runNode(root, [
    publicCli,
    "--json",
    "show",
    "PUBLIC-BOUNDARY-ALPHA-001"
  ]);
  assert.equal(shown.code, 0, shown.stderr);
  const showed = v.parse(publicApi.testEvidenceShowResultSchema, json(shown));
  assert.match(
    showed.markdown ?? assert.fail("show must return authoritative Markdown"),
    /alpha Case/u
  );

  const searched = await runNode(root, [
    publicCli,
    "--json",
    "search",
    "authoritative needle",
    "--tag",
    "beta"
  ]);
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

test("distributed sync requires --write, while stage preserves help and domain failure boundaries", async (context) => {
  const root = await fixture(context);
  const index = path.join(root, "docs/test-evidence/test-evidence-index.json");
  const checked = await runNode(root, [publicCli, "--json", "sync-index"]);
  assert.equal(checked.code, 1, checked.stderr);
  v.parse(publicApi.testEvidenceSyncResultSchema, json(checked));
  await assert.rejects(fs.access(index));

  await writeIndex(root);
  await fs.access(index);

  const help = await runNode(root, [publicCli, "stage-index", "--help"]);
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /stage-index \[options\] <case-ids\.\.\.>/u);

  const malformed = await runNode(root, [
    publicCli,
    "--json",
    "stage-index",
    "not-a-case-id"
  ]);
  assert.equal(malformed.code, 2, malformed.stderr);
  assert.equal(malformed.stdout, "");
  assert.match(malformed.stderr, /error:/u);

  const missing = await runNode(root, [
    publicCli,
    "--json",
    "stage-index",
    "PUBLIC-BOUNDARY-MISSING-001"
  ]);
  assert.equal(missing.code, 1, missing.stderr);
  assert.equal(missing.stderr, "");
  const failure = v.parse(
    publicApi.testEvidenceStageResultSchema,
    json(missing)
  );
  assert.equal(failure.status, "error");
});

test("distributed Node CLI writes usage failures only to stderr with exit two", async (context) => {
  const root = await fixture(context);
  const result = await runNode(root, [
    publicCli,
    "--json",
    "list",
    "--unknown"
  ]);
  assert.equal(result.code, 2, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /error: unknown option '--unknown'/u);
});

test("public query API returns schema-valid diagnostics for invalid options", async (context) => {
  const root = await fixture(context);
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
  const root = await fixture(context);
  for (const missing of [
    "package.json",
    "docs/test-evidence/test-entity-index.json",
    ".test-evidence.json"
  ])
    await assert.rejects(fs.access(path.join(root, missing)));
  await writeIndex(root);
  const list = await runNode(root, [publicCli, "--json", "list"]);
  assert.equal(list.code, 0, list.stderr);
  const result = v.parse(publicApi.testEvidenceQueryResultSchema, json(list));
  assert.equal(result.total, 2);
});
