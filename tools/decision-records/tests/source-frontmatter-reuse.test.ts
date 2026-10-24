import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseDecisionMarkdown } from "../src/decision-metadata.ts";
import { readDecisionSourceRevision } from "../src/decision-index-source.ts";
import { validateDecisionBody } from "../src/record.ts";
import {
  collectSourceFiles,
  validateSourceMembership
} from "../src/scan-collection.ts";
import type { SourceFile } from "../src/scan-contracts.ts";
import { scanSourceFiles } from "../src/scan-records.ts";
import {
  candidateDecisionBody,
  currentSourcePath,
  decisionFilePath,
  runSourceCli,
  withFixtureWorkspace,
  withTemporaryWorkspace
} from "./support.ts";

function inMemorySource(sourcePath: string, sourceText: string): SourceFile {
  return { decisionPath: "/unused/" + sourcePath, sourcePath, sourceText };
}

async function scanAcquiredSources(sourceFiles: readonly SourceFile[]) {
  const collectionErrors: string[] = [];
  const sourceErrors: string[] = [];
  const availableDecisionIds = await validateSourceMembership(
    sourceFiles,
    collectionErrors,
    sourceErrors
  );
  const records = await scanSourceFiles({
    availableDecisionIds,
    index: null,
    indexErrors: [],
    indexRelativePath: "docs/decisions/decision-index.json",
    sourceErrors,
    sourceFiles
  });
  return { availableDecisionIds, collectionErrors, records, sourceErrors };
}

test("Decision raw validators reject malformed Markdown despite caller-supplied parsed frontmatter", async () => {
  const errors: string[] = [];
  const options = {
    errors,
    markdown: "---\n- not-a-mapping\n---\n",
    relativePath: "raw.md",
    sourceFrontmatter: {
      error: null,
      keys: [],
      values: { id: "forged", status: "candidate" }
    }
  };
  assert.equal(parseDecisionMarkdown(options), null);
  assert.deepEqual(errors, ["raw.md frontmatter must be a YAML mapping"]);
  errors.length = 0;
  const validated = await validateDecisionBody({
    ...options,
    body: options.markdown,
    sourcePath: options.relativePath,
    targetExists: () => true
  });
  assert.equal(validated, null);
  assert.deepEqual(errors, [
    "raw.md frontmatter must be a YAML mapping",
    'raw.md body must start with "## 目的"',
    "raw.md is missing section ## 目的",
    "raw.md is missing section ## 背景",
    "raw.md is missing section ## 决策"
  ]);
});

test("Decision same-acquisition scan preserves normalized body and exact raw source bytes", async () => {
  const plain = candidateDecisionBody({ id: "declared-identity" });
  const raw = "\uFEFF" + plain.replace(/\n/g, "\r\n");
  const result = await scanAcquiredSources([
    inMemorySource("different-name.md", raw)
  ]);
  assert.deepEqual(result.collectionErrors, []);
  assert.deepEqual(result.sourceErrors, []);
  assert.deepEqual([...result.availableDecisionIds], ["declared-identity"]);
  const record = result.records[0]!;
  assert.equal(record.decisionId, "declared-identity");
  assert.equal(record.sourcePath, "different-name.md");
  assert.equal(record.scaffoldValid, true);
  assert.equal(record.bodyReady, true);
  assert.equal(record.source.kind, "candidate");
  assert.equal(record.source.text, raw);
  assert.ok(record.source.kind === "candidate");
  assert.equal(record.source.body, plain.slice(plain.indexOf("## 目的")));
});

test("Decision same-acquisition scan retains frontmatter failures before body diagnostics", async () => {
  for (const [raw, diagnostic] of [
    ["not frontmatter", /must start with YAML frontmatter$/],
    ["---\n- not-a-mapping\n---\n", /frontmatter must be a YAML mapping$/],
    ["---\nid: [\n---\n", /frontmatter Flow sequence/s],
    ["---\nid: first\nid: second\n---\n", /frontmatter Map keys must be unique/]
  ] as const) {
    const result = await scanAcquiredSources([
      inMemorySource("invalid.md", raw)
    ]);
    assert.equal(result.availableDecisionIds.size, 0);
    assert.deepEqual(result.collectionErrors, []);
    assert.match(result.sourceErrors[0]!, diagnostic);
    assert.deepEqual(result.sourceErrors.slice(1), [
      'invalid.md body must start with "## 目的"',
      "invalid.md is missing section ## 目的",
      "invalid.md is missing section ## 背景",
      "invalid.md is missing section ## 决策",
      "invalid.md status must match its physical sourcePath"
    ]);
    assert.equal(result.records[0]?.source.kind, "invalid");
    assert.equal(result.records[0]?.source.text, raw);
  }
});

test("Decision membership retains invalid-record identities while duplicate IDs stay unavailable to relations", async () => {
  const invalid = candidateDecisionBody({ id: "shared", tags: [] });
  const referencing = candidateDecisionBody({
    id: "referencing",
    relations: [{ type: "修订", target: "shared" }]
  });
  const result = await scanAcquiredSources([
    inMemorySource("first.md", invalid),
    inMemorySource("second.md", candidateDecisionBody({ id: "shared" })),
    inMemorySource("reference.md", referencing)
  ]);
  assert.deepEqual([...result.availableDecisionIds], ["referencing"]);
  const duplicate =
    "Decision ID occurs in more than one source path: shared (first.md, second.md)";
  assert.deepEqual(result.collectionErrors, [duplicate]);
  assert.equal(result.sourceErrors[0], duplicate);
  assert.equal(
    result.sourceErrors[1],
    "first.md frontmatter tags must be a non-empty array"
  );
  assert.ok(
    result.sourceErrors.includes(
      "reference.md relationship 修订 target does not exist: shared"
    )
  );
  assert.equal(result.records[0]?.decisionId, "shared");
  assert.equal(result.records[0]?.source.kind, "invalid");
  assert.equal(result.records[1]?.source.kind, "candidate");
  assert.equal(result.records[2]?.source.kind, "invalid");
});

test("Decision fresh revision independently rereads and reparses after an acquired scan", async () => {
  await withTemporaryWorkspace("frontmatter-fresh", async (root) => {
    const directory = path.join(root, "docs/decisions");
    await fs.mkdir(directory, { recursive: true });
    const file = path.join(directory, "physical.md");
    const before = candidateDecisionBody({ id: "fresh-id" })
      .replace("status: candidate", "status: active")
      .replace("alignment: null", "alignment: aligned")
      .replace("createdAt: null", "createdAt: 2026-10-24T12:00:00Z");
    await fs.writeFile(file, before);
    const firstRevision = await readDecisionSourceRevision(
      directory,
      undefined
    );
    const sourceErrors: string[] = [];
    const sources = await collectSourceFiles({
      collectionErrors: [],
      decisionsDirectory: directory,
      decisionsLabel: "docs/decisions",
      sourceErrors
    });
    const availableDecisionIds = await validateSourceMembership(
      sources,
      [],
      sourceErrors
    );
    await fs.writeFile(file, before + "\nChanged after acquisition.\n");
    const records = await scanSourceFiles({
      availableDecisionIds,
      index: null,
      indexErrors: [],
      indexRelativePath: "docs/decisions/decision-index.json",
      sourceErrors,
      sourceFiles: sources
    });
    assert.deepEqual(sourceErrors, []);
    assert.ok(records[0] && records[0].source.kind !== "missing");
    assert.equal(records[0].source.text, before);
    assert.equal(records[0]?.decisionId, "fresh-id");
    const changedRevision = await readDecisionSourceRevision(
      directory,
      undefined
    );
    assert.notDeepEqual(changedRevision, firstRevision);
    await fs.writeFile(file, before.replace("id: fresh-id", "id: ["));
    await assert.rejects(
      readDecisionSourceRevision(directory, undefined),
      /physical.md must declare a valid frontmatter Decision ID/
    );
    await fs.rm(file);
    await assert.rejects(
      readDecisionSourceRevision(directory, ["fresh-id"]),
      /Decision ID does not resolve to a source path: fresh-id/
    );
  });
});

test("Decision sync rejects malformed fresh bytes without publishing an index from an earlier parse", async () => {
  await withFixtureWorkspace("frontmatter-sync-fresh", async (root) => {
    const file = decisionFilePath(root, currentSourcePath);
    const indexPath = path.join(root, "docs/decisions/decision-index.json");
    const indexBefore = await fs.readFile(indexPath);
    const originalText = await fs.readFile(file, "utf8");
    const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
    assert.ok(descriptor);
    const open = fs.open.bind(fs);
    let acquisitions = 0;
    Object.defineProperty(fs, "open", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.open>) => {
        if (String(args[0]) === file && ++acquisitions === 2) {
          await fs.writeFile(file, originalText.replace(/^id: .+$/m, "id: ["));
        }
        return await open(...args);
      }
    });
    let result: Awaited<ReturnType<typeof runSourceCli>>;
    try {
      result = await runSourceCli(["sync-index", "--root", root]);
    } finally {
      Object.defineProperty(fs, "open", descriptor);
    }
    assert.ok(acquisitions >= 2, "fresh acquisition must actually run");
    assert.equal(result.exitCode, 1, result.stdout);
    assert.match(
      result.stderr,
      /failed to read the current state-index source revision/
    );
    assert.deepEqual(await fs.readFile(indexPath), indexBefore);
    assert.match(await fs.readFile(file, "utf8"), /^id: \[$/m);
  });
});
