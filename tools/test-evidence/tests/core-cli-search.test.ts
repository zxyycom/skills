import assert from "node:assert/strict";
import os from "node:os";
import test from "node:test";
import * as v from "valibot";
import {
  listTestEvidenceTags,
  queryTestEvidence,
  searchTestEvidence,
  showTestEvidenceCase,
  stageTestEvidenceIndex,
  syncTestEvidenceIndex,
  validateTestEvidence,
  validateTestEvidenceReferences
} from "../src/core.ts";
import { runTestEvidenceCatalogCli } from "../src/cli.ts";
import {
  testEvidenceReferenceResultSchema,
  testEvidenceSearchResultSchema,
  testEvidenceStageResultSchema
} from "../src/core-schemas.ts";
import { exec, fixture, fs, path } from "./core-test-support.ts";

test("list and tags only load the index while show reads only its selected Case", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await fs.rm(path.join(root, "docs/test-evidence/cases/second.md"));
  assert.equal(
    (
      await showTestEvidenceCase({
        workspaceRoot: root,
        caseId: "AUTH-ROLE-ACCESS-001"
      })
    ).case?.id,
    "AUTH-ROLE-ACCESS-001"
  );
  await fs.rename(
    path.join(root, "docs/test-evidence/cases"),
    path.join(root, "docs/test-evidence/cases-hidden")
  );
  assert.equal((await queryTestEvidence({ workspaceRoot: root })).total, 2);
  assert.deepEqual(
    (await listTestEvidenceTags({ workspaceRoot: root })).tags.map(
      (entry) => entry.tag
    ),
    ["access-control", "security"]
  );
});
test(
  "search includes matches after the index query page boundary",
  { timeout: 20_000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "test-evidence-search-")
    );
    const cases = path.join(root, "docs/test-evidence/cases");
    await fs.mkdir(cases, { recursive: true });
    for (let index = 0; index <= 1000; index += 1) {
      const id = String(index).padStart(3, "0");
      const body = index === 1000 ? "needle" : "filler";
      await fs.writeFile(
        path.join(cases, `candidate-${id}.md`),
        `### Case SEARCH-${String(index).padStart(4, "0")}-CANDIDATE-001: candidate ${id}\n\nTests:\n- \`test:search-${id}\`\n\nContract:\n- ${body}\n\nProves:\n- search scans every matching Case\n`
      );
    }
    assert.equal(
      (await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" }))
        .status,
      "ok"
    );
    const result = await searchTestEvidence({
      workspaceRoot: root,
      text: "needle"
    });
    assert.deepEqual(
      result.cases.map((entry) => entry.id),
      ["SEARCH-1000-CANDIDATE-001"]
    );
  }
);

test("search rejects invalid API paging with default empty results", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  for (const options of [
    { limit: 0 },
    { limit: -1 },
    { limit: 1.5 },
    { offset: -1 }
  ]) {
    const result = await searchTestEvidence({
      workspaceRoot: root,
      text: "permission",
      ...options
    });
    assert.equal(result.limit, 20);
    assert.equal(result.offset, 0);
    assert.equal(result.sourceRevision, null);
    assert.equal(result.total, 0);
    assert.deepEqual(result.cases, []);
    assert.deepEqual(
      result.diagnostics.map((entry) => entry.code),
      ["query.options-invalid"]
    );
    assert.ok(v.safeParse(testEvidenceSearchResultSchema, result).success);
  }
});

test("search rejects stale Case indexes through its API and CLI", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  const result = await searchTestEvidence({
    workspaceRoot: root,
    text: "permission"
  });
  assert.equal(result.sourceRevision, null);
  assert.equal(result.total, 0);
  assert.deepEqual(result.cases, []);
  assert.deepEqual(
    result.diagnostics.map((entry) => entry.code),
    ["state-index.index-stale"]
  );
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runTestEvidenceCatalogCli(
    ["--root", root, "--json", "search", "permission"],
    {
      io: {
        stderr: (text) => stderr.push(text),
        stdout: (text) => stdout.push(text)
      }
    }
  );
  assert.equal(code, 1);
  assert.equal(stderr.join(""), "");
  assert.deepEqual(
    JSON.parse(stdout.join("")).diagnostics.map(
      (entry: { code: string }) => entry.code
    ),
    ["state-index.index-stale"]
  );
});

test("snapshot failure priorities reject malformed input, source mismatch, and unknown selection", async () => {
  const root = await fixture();
  const source = {
    projectId: "skills",
    scopeId: "registered-tests",
    revision: "r1"
  };
  const snapshot = {
    schemaVersion: 2,
    source,
    completeness: "complete",
    entities: [
      { id: "test:access", name: "access", locators: ["a"] },
      { id: "test:shared", name: "shared", locators: ["s"] }
    ]
  };
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot: { ...snapshot, schemaVersion: 1 },
        expectedSource: source
      })
    ).state,
    "snapshot-invalid"
  );
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot,
        expectedSource: { ...source, revision: "wrong" }
      })
    ).state,
    "source-mismatch"
  );
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot,
        expectedSource: source,
        caseIds: ["AUTH-ROLE-ACCESS-999"]
      })
    ).state,
    "case-invalid"
  );
});
test("CLI writes domain failures as JSON stdout with a nonzero exit", async () => {
  const root = await fixture();
  const invoke = async (snapshot: string) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await runTestEvidenceCatalogCli(
      [
        "check-refs",
        "--root",
        root,
        "--snapshot",
        snapshot,
        "--expect-project",
        "skills",
        "--expect-scope",
        "registered-tests",
        "--expect-revision",
        "r1",
        "--json"
      ],
      {
        io: {
          stdout: (value) => stdout.push(value),
          stderr: (value) => stderr.push(value)
        }
      }
    );
    assert.equal(code, 1);
    assert.equal(stderr.join(""), "");
    const result = JSON.parse(stdout.join(""));
    assert.equal(result.state, "snapshot-invalid");
    assert.ok(v.safeParse(testEvidenceReferenceResultSchema, result).success);
  };
  await invoke("missing.json");
  await fs.writeFile(path.join(root, "invalid.json"), new Uint8Array([0xff]));
  await invoke("invalid.json");
  const oversized = path.join(root, "oversized.json");
  await fs.writeFile(oversized, "");
  await fs.truncate(oversized, 64 * 1024 * 1024 + 1);
  await invoke("oversized.json");
});
test("search blocks a Case body above the shared text-search resource limit", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-resource-")
  );
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await fs.writeFile(
    path.join(cases, "large.md"),
    `### Case RESOURCE-LARGE-CASE-001: large body\n\nTests:\n- \`test:large\`\n\nContract:\n- needle ${"x".repeat(2 * 1024 * 1024)}\n\nProves:\n- bounded read\n`
  );
  assert.equal(
    (await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" }))
      .status,
    "ok"
  );
  const result = await searchTestEvidence({
    workspaceRoot: root,
    text: "needle"
  });
  assert.ok(
    result.diagnostics.some((entry) => entry.code === "search.resource-limit")
  );
});
test("selected staging uses the existing Git index boundary", async () => {
  const root = await fixture();
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root
  });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "baseline"], { cwd: root });
  await fs.writeFile(path.join(root, "unrelated.txt"), "already staged\n");
  await exec("git", ["add", "unrelated.txt"], { cwd: root });
  const pendingUnrelated = await exec("git", ["show", ":unrelated.txt"], {
    cwd: root
  });
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const staged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(staged.status, "ok");
  assert.ok(v.safeParse(testEvidenceStageResultSchema, staged).success);
  const { stdout } = await exec("git", ["diff", "--cached", "--name-only"], {
    cwd: root
  });
  assert.deepEqual(stdout.trim().split("\n"), [
    "docs/test-evidence/test-evidence-index.json",
    "unrelated.txt"
  ]);
  assert.equal(
    (await exec("git", ["show", ":unrelated.txt"], { cwd: root })).stdout,
    pendingUnrelated.stdout
  );
});
test("Case hard-link identity conflicts are rejected", async () => {
  const root = await fixture();
  await fs.link(
    path.join(root, "docs/test-evidence/cases/access.md"),
    path.join(root, "docs/test-evidence/cases/linked.md")
  );
  const report = await validateTestEvidence({ workspaceRoot: root });
  assert.ok(
    report.diagnostics.some((entry) => entry.code === "case.identity-conflict")
  );
});
test("selected staging rejects a cross-definition index migration", async () => {
  const root = await fixture();
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root
  });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "baseline"], { cwd: root });
  const indexPath = path.join(
    root,
    "docs/test-evidence/test-evidence-index.json"
  );
  const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
  index.definitionVersion = 5;
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const staged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(staged.status, "error");
});
test("search rejects a Case source that changes during the authoritative read", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const target = path.join(root, "docs/test-evidence/cases/access.md");
  const originalOpen = fs.open;
  let changed = false;
  const mutableFs = fs as { open: typeof fs.open };
  mutableFs.open = (async (...args: Parameters<typeof originalOpen>) => {
    const handle = await originalOpen(...args);
    if (path.resolve(String(args[0])) === target && !changed) {
      changed = true;
      await fs.appendFile(target, "\n");
    }
    return handle;
  }) as typeof fs.open;
  try {
    const result = await searchTestEvidence({
      workspaceRoot: root,
      text: "permission"
    });
    assert.equal(changed, true, "search did not open the authoritative source");
    assert.deepEqual(
      result.diagnostics.map((entry) => entry.code),
      ["state-index.source-changed"],
      JSON.stringify(result)
    );
  } finally {
    mutableFs.open = originalOpen;
  }
});

test("index synchronization distinguishes missing, written, and current snapshots", async () => {
  const root = await fixture();
  const missing = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "check"
  });
  assert.equal(missing.status, "error");
  assert.equal(missing.state, "index-missing");
  const written = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write"
  });
  assert.equal(written.status, "ok");
  assert.equal(written.state, "written");
  const current = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write"
  });
  assert.equal(current.status, "ok");
  assert.equal(current.state, "unchanged");
  assert.equal(current.changed, false);
});

test("unreadable indexes block list and show without a source fallback", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await fs.writeFile(
    path.join(root, "docs/test-evidence/test-evidence-index.json"),
    new Uint8Array([0xff])
  );
  const listed = await queryTestEvidence({ workspaceRoot: root });
  const shown = await showTestEvidenceCase({
    workspaceRoot: root,
    caseId: "AUTH-ROLE-ACCESS-001"
  });
  assert.equal(listed.total, 0);
  assert.equal(shown.case, null);
  for (const result of [listed, shown])
    assert.ok(
      result.diagnostics.some(
        (entry) => entry.code === "state-index.index-encoding-invalid"
      ),
      JSON.stringify(result)
    );
});
