import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncDecisionIndex } from "../../src/decision-state-index.ts";
import { candidateDecisionBody } from "../support-record-fixture.ts";

type FormalSource = Readonly<{ id: string; sourcePath: string; text: string }>;
export type PublishedCandidateFixture = Readonly<{
  root: string;
  directory: string;
  indexPath: string;
  formal: readonly FormalSource[];
}>;

export async function withPublishedCandidateFixture(
  run: (fixture: PublishedCandidateFixture) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "candidate-published-"));
  const directory = path.join(root, "docs/decisions");
  await fs.mkdir(path.join(directory, "archive"), { recursive: true });
  const formal = Array.from({ length: 20 }, (_, index) => {
    const archived = index >= 10;
    const id = `261021-formal-${index}`;
    const sourcePath = `${archived ? "archive/" : ""}location-${index}.md`;
    const text = candidateDecisionBody({ id })
      .replace(
        "status: candidate",
        "status: " + (archived ? "archived" : "active")
      )
      .replace("alignment: null", "alignment: aligned")
      .replace("createdAt: null", "createdAt: 2026-10-21T00:00:00+00:00");
    return { id, sourcePath, text };
  });
  try {
    for (const source of formal)
      await fs.writeFile(path.join(directory, source.sourcePath), source.text);
    const synchronized = await syncDecisionIndex({
      decisionsDirectory: directory,
      mode: "write"
    });
    assert.equal(synchronized.status, "ok");
    for (const name of ["one", "two"])
      await fs.writeFile(
        path.join(directory, `candidate-${name}.md`),
        candidateDecisionBody({ id: `261022-ready-${name}` })
      );
    for (const source of formal)
      await fs.writeFile(
        path.join(directory, source.sourcePath),
        "malformed unrelated formal content\n"
      );
    await run({
      root,
      directory,
      formal,
      indexPath: path.join(directory, "decision-index.json")
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

type ReadCounts = { opens: number; handleReads: number; reads: number };
export async function observeCandidateReads<Value>(
  fixture: PublishedCandidateFixture,
  run: () => Promise<Value>
) {
  const formalPaths = new Set(
    fixture.formal.map(({ sourcePath }) =>
      path.join(fixture.directory, sourcePath)
    )
  );
  const counts = {
    formal: { opens: 0, handleReads: 0, reads: 0 },
    other: { opens: 0, handleReads: 0, reads: 0 }
  };
  const classify = (target: unknown): ReadCounts | null => {
    if (
      typeof target !== "string" ||
      !target.startsWith(fixture.directory + path.sep) ||
      !target.endsWith(".md")
    )
      return null;
    return formalPaths.has(target) ? counts.formal : counts.other;
  };
  const originalOpen = fs.open;
  const originalRead = fs.readFile;
  fs.open = async (...args: Parameters<typeof fs.open>) => {
    const handle = await originalOpen(...args);
    const count = classify(args[0]);
    if (count !== null) {
      count.opens += 1;
      const read = handle.readFile.bind(handle);
      handle.readFile = (async (...readArgs: Parameters<typeof read>) => {
        count.handleReads += 1;
        return await read(...readArgs);
      }) as typeof handle.readFile;
    }
    return handle;
  };
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const count = classify(args[0]);
    if (count !== null) count.reads += 1;
    return await originalRead(...args);
  }) as typeof fs.readFile;
  try {
    return { value: await run(), counts };
  } finally {
    fs.open = originalOpen;
    fs.readFile = originalRead;
  }
}
