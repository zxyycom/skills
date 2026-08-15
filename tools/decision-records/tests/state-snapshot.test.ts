import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  buildDecisionStateSnapshotFromSources,
  decisionSourceRevision,
} from "../src/decision-state-index.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  fixtureRoot,
} from "./support.ts";

function establishedMarkdown(tags = ["decision-records"]): string {
  return candidateDecisionBody({ tags })
    .replace("status: candidate", "status: active")
    .replace("alignment: null", "alignment: aligned")
    .replace("createdAt: null", "createdAt: 2026-08-03T10:20:30Z");
}

test("state snapshots are isolated from later source mutations", async () => {
  const source = {
    decisionId: "use-snapshot.md",
    sourcePath: "use-snapshot.md",
    text: establishedMarkdown(),
  };
  const snapshot = await buildDecisionStateSnapshotFromSources([source]);
  source.text = establishedMarkdown(["project-tooling"]);
  assert.deepEqual(snapshot.states["use-snapshot.md"].tags, [
    "decision-records",
  ]);
});

test("memory sources share deterministic ID-keyed index construction", async () => {
  const sources = [
    {
      decisionId: "use-a.md",
      sourcePath: "use-a.md",
      text: establishedMarkdown(),
    },
    {
      decisionId: "use-b.md",
      sourcePath: "archive/use-b.md",
      text: establishedMarkdown(),
    },
  ];
  assert.deepEqual(
    await buildDecisionStateSnapshotFromSources(sources),
    await buildDecisionStateSnapshotFromSources([...sources].reverse()),
  );
});

test("source revisions fingerprint invalid Markdown and sourcePath without parsing it", () => {
  const original = decisionSourceRevision([
    {
      decisionId: "use-invalid.md",
      sourcePath: "use-invalid.md",
      text: "not Markdown\n",
    },
  ]);
  const moved = decisionSourceRevision([
    {
      decisionId: "use-invalid.md",
      sourcePath: "archive/use-invalid.md",
      text: "not Markdown\n",
    },
  ]);
  assert.notEqual(
    moved.entries["use-invalid.md"],
    original.entries["use-invalid.md"],
  );
});

test("in-memory decision sources reject invalid IDs and source paths before deriving revisions", () => {
  for (const { source, expected } of [
    {
      source: {
        decisionId: "invalid_name.md",
        sourcePath: "invalid-name.md",
        text: "source\n",
      },
      expected: /invalid Decision ID/,
    },
    {
      source: {
        decisionId: "use-valid.md",
        sourcePath: "nested/use-valid.md",
        text: "source\n",
      },
      expected: /invalid source path/,
    },
    {
      source: {
        decisionId: "use-valid.md",
        sourcePath: "archive/use-other.md",
        text: "source\n",
      },
      expected: /path does not match Decision ID/,
    },
  ]) {
    assert.throws(() => decisionSourceRevision([source]), expected);
  }
});

async function fixtureSources(): Promise<
  Array<{ decisionId: string; sourcePath: string; text: string }>
> {
  return await Promise.all(
    [
      [currentDecisionId, currentSourcePath],
      [archivedDecisionId, archivedSourcePath],
    ].map(async ([decisionId, sourcePath]) => ({
      decisionId,
      sourcePath,
      text: await fs.readFile(
        path.join(fixtureRoot, "docs", "decisions", ...sourcePath.split("/")),
        "utf8",
      ),
    })),
  );
}

test("memory source snapshots ignore same-name filesystem relation targets", async () => {
  const sources = await fixtureSources();
  await assert.rejects(
    buildDecisionStateSnapshotFromSources(
      sources.filter((source) => source.decisionId !== archivedDecisionId),
    ),
    /target does not exist/,
  );
});

test("memory source snapshots reject active relationship targets", async () => {
  const sources = await fixtureSources();
  const activeTarget = sources.map((source) =>
    source.decisionId !== archivedDecisionId
      ? source
      : {
          ...source,
          sourcePath: archivedDecisionId,
          text: source.text
            .replace("status: archived", "status: active")
            .replace("alignment: null", "alignment: aligned"),
        },
  );
  await assert.rejects(
    buildDecisionStateSnapshotFromSources(activeTarget),
    /target must be archived/,
  );
});

test("memory source snapshots reject relationship cycles", async () => {
  const sources = await fixtureSources();
  const cycle = sources.map((source) =>
    source.decisionId !== archivedDecisionId
      ? {
          ...source,
          sourcePath: `archive/${currentDecisionId}`,
          text: source.text
            .replace("status: active", "status: archived")
            .replace("alignment: aligned", "alignment: null"),
        }
      : {
          ...source,
          text: source.text.replace(
            "relations: []",
            `relations:\n  - type: 修订\n    target: ${currentDecisionId}`,
          ),
        },
  );
  await assert.rejects(
    buildDecisionStateSnapshotFromSources(cycle),
    /must not form a cycle/,
  );
});
