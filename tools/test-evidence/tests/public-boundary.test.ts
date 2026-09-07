import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as publicApi from "../../../skills/test-evidence-review/scripts/test-evidence-catalog.mjs";

const publicCli = path.resolve(
  process.cwd(),
  "skills/test-evidence-review/scripts/test-evidence-catalog.mjs"
);

type CliResult = Readonly<{
  code: number | null;
  stderr: string;
  stdout: string;
}>;

type PublicSchema = Readonly<{
  "~standard": Readonly<{
    validate: (value: unknown) => Readonly<{ issues?: readonly unknown[] }>;
  }>;
}>;

async function runNodeCli(
  root: string,
  args: readonly string[]
): Promise<CliResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn("node", [publicCli, ...args], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr, stdout }));
  });
}

function json(result: CliResult): unknown {
  assert.notEqual(result.stdout, "", result.stderr);
  return JSON.parse(result.stdout);
}

function assertPublicSchema(name: string, value: unknown): void {
  const candidate = (publicApi as unknown as Record<string, unknown>)[name];
  assert.equal(typeof candidate, "object", `${name} is not exported`);
  assert.notEqual(candidate, null, `${name} is not exported`);
  const result = (candidate as PublicSchema)["~standard"].validate(value);
  assert.equal(
    result.issues,
    undefined,
    `${name} rejected ${JSON.stringify(value)}`
  );
}

async function fixture(): Promise<Readonly<{ root: string; parent: string }>> {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-public-")
  );
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
  return { parent, root };
}

async function removeFixture(parent: string): Promise<void> {
  await fs.rm(parent, { force: true, recursive: true });
}

async function writeIndex(root: string): Promise<void> {
  const result = await runNodeCli(root, ["--json", "sync-index", "--write"]);
  assert.equal(result.code, 0, result.stderr);
  assertPublicSchema("testEvidenceSyncResultSchema", json(result));
}

test("distributed MJS imports in Node without side effects and exposes only the current public API", async () => {
  const root = await fixture();
  try {
    const program = [
      `const module = await import(${JSON.stringify(`file://${publicCli}`)});`,
      "process.stdout.write(JSON.stringify(Object.keys(module).sort()));"
    ].join("\n");
    const result = await new Promise<CliResult>((resolve, reject) => {
      const child = spawn("node", ["--input-type=module", "--eval", program], {
        cwd: root.root
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => (stdout += chunk));
      child.stderr.on("data", (chunk: string) => (stderr += chunk));
      child.once("error", reject);
      child.once("close", (code) => resolve({ code, stderr, stdout }));
    });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [
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
  } finally {
    await removeFixture(root.parent);
  }
});

test("distributed Node CLI returns schema-valid Case list, tags, show, and search JSON", async () => {
  const root = await fixture();
  try {
    await writeIndex(root.root);
    const list = await runNodeCli(root.root, [
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
    const listed = json(list);
    assertPublicSchema("testEvidenceQueryResultSchema", listed);
    assert.deepEqual(
      (listed as { cases: { id: string }[] }).cases.map((entry) => entry.id),
      ["PUBLIC-BOUNDARY-ALPHA-001"]
    );

    const tags = await runNodeCli(root.root, ["--json", "tags"]);
    assert.equal(tags.code, 0, tags.stderr);
    const tagged = json(tags);
    assertPublicSchema("testEvidenceTagsResultSchema", tagged);
    assert.deepEqual((tagged as { tags: unknown }).tags, [
      { caseCount: 2, tag: "alpha" },
      { caseCount: 1, tag: "beta" }
    ]);

    const shown = await runNodeCli(root.root, [
      "--json",
      "show",
      "PUBLIC-BOUNDARY-ALPHA-001"
    ]);
    assert.equal(shown.code, 0, shown.stderr);
    const showed = json(shown);
    assertPublicSchema("testEvidenceShowResultSchema", showed);
    assert.match((showed as { markdown: string }).markdown, /alpha Case/u);

    const searched = await runNodeCli(root.root, [
      "--json",
      "search",
      "authoritative needle",
      "--tag",
      "beta"
    ]);
    assert.equal(searched.code, 0, searched.stderr);
    const search = json(searched);
    assertPublicSchema("testEvidenceSearchResultSchema", search);
    assert.deepEqual(
      (search as { cases: { id: string }[] }).cases.map((entry) => entry.id),
      ["PUBLIC-BOUNDARY-BETA-001"]
    );
  } finally {
    await removeFixture(root.parent);
  }
});

test("distributed sync requires --write, while stage preserves help and domain failure boundaries", async () => {
  const root = await fixture();
  try {
    const index = path.join(
      root.root,
      "docs/test-evidence/test-evidence-index.json"
    );
    const checked = await runNodeCli(root.root, ["--json", "sync-index"]);
    assert.equal(checked.code, 1, checked.stderr);
    assertPublicSchema("testEvidenceSyncResultSchema", json(checked));
    await assert.rejects(fs.access(index));

    await writeIndex(root.root);
    await fs.access(index);

    const help = await runNodeCli(root.root, ["stage-index", "--help"]);
    assert.equal(help.code, 0, help.stderr);
    assert.match(help.stdout, /stage-index \[options\] <case-ids\.\.\.>/u);

    const malformed = await runNodeCli(root.root, [
      "--json",
      "stage-index",
      "not-a-case-id"
    ]);
    assert.equal(malformed.code, 2, malformed.stderr);
    assert.equal(malformed.stdout, "");
    assert.match(malformed.stderr, /error:/u);

    const missing = await runNodeCli(root.root, [
      "--json",
      "stage-index",
      "PUBLIC-BOUNDARY-MISSING-001"
    ]);
    assert.equal(missing.code, 1, missing.stderr);
    assert.equal(missing.stderr, "");
    assertPublicSchema("testEvidenceStageResultSchema", json(missing));
    assert.equal((json(missing) as { status: string }).status, "error");
  } finally {
    await removeFixture(root.parent);
  }
});

test("public CLI usage errors and API invalid options retain separate structured failures", async () => {
  const root = await fixture();
  try {
    await writeIndex(root.root);
    for (const args of [
      ["--json", "list", "--unknown"],
      ["--json", "show"],
      ["--json", "list", "--limit", "1", "--limit", "2"],
      ["--json", "list", "--limit", "zero"]
    ]) {
      const result = await runNodeCli(root.root, args);
      assert.equal(result.code, 2, `${args.join(" ")}\n${result.stderr}`);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /error:/u);
    }
    const invalid = await publicApi.queryTestEvidence({
      limit: 0,
      workspaceRoot: root.root
    });
    assertPublicSchema("testEvidenceQueryResultSchema", invalid);
    assert.ok(
      invalid.diagnostics.some(
        (diagnostic: { code: string }) =>
          diagnostic.code === "query.options-invalid"
      )
    );
  } finally {
    await removeFixture(root.parent);
  }
});

test("Case query and explicit sync operate without project configuration or an entity snapshot", async () => {
  const root = await fixture();
  try {
    for (const missing of [
      "package.json",
      "docs/test-evidence/test-entity-index.json",
      ".test-evidence.json"
    ])
      await assert.rejects(fs.access(path.join(root.root, missing)));
    await writeIndex(root.root);
    const list = await runNodeCli(root.root, ["--json", "list"]);
    assert.equal(list.code, 0, list.stderr);
    const result = json(list);
    assertPublicSchema("testEvidenceQueryResultSchema", result);
    assert.equal((result as { total: number }).total, 2);
  } finally {
    await removeFixture(root.parent);
  }
});
