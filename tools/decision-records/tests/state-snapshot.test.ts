import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  parseDecisionDomainCatalog,
  type DecisionDomainCatalog
} from "../src/decision-domain-catalog.ts";
import {
  buildDecisionIndexFromSnapshot,
  buildDecisionStateSnapshotFromSources,
  decisionSourceRevision,
  readDecisionStateSnapshot,
  serializeDecisionIndex,
  type DecisionSource,
  syncDecisionIndex
} from "../src/decision-state-index.ts";
import { selectDecisionIndexSourcePaths } from "../src/index.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  currentRelativePath,
  findIndexEntry,
  fixtureRoot,
  readIndex,
  withFixtureWorkspace
} from "./support.ts";

test("state snapshots are isolated from later source mutations", async () => {
const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-state-snapshot-")
);
try {
  await fs.cp(fixtureRoot, tempRoot, { recursive: true });
  const scan = await scanDecisionRecords({ workspaceRoot: tempRoot });
  const selection = selectDecisionIndexSourcePaths(scan);
  assert.deepEqual(selection.errors, []);

  const decisionsDirectory = path.join(tempRoot, "docs", "decisions");
  const decisionPath = path.join(decisionsDirectory, currentRelativePath);
  const original = await fs.readFile(decisionPath, "utf8");
  const nextTitle = "使用当前快照读取器";
  await fs.writeFile(
    decisionPath,
    original.replace("title: 使用生成 CLI", `title: ${nextTitle}`),
    "utf8"
  );

  const synchronized = await syncDecisionIndex({
    decisionsDirectory,
    mode: "write",
    relativePaths: selection.relativePaths
  });
  assert.equal(synchronized.status, "ok");

  const index = await readIndex(path.join(
    decisionsDirectory,
    "decision-index.json"
  ));
  assert.equal(
    findIndexEntry(index, currentRelativePath).title,
    nextTitle
  );
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}
});

test("memory and filesystem sources share deterministic index construction", () => (
  withFixtureWorkspace("memory-snapshot-index", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const scan = await scanDecisionRecords({ workspaceRoot });
  const selection = selectDecisionIndexSourcePaths(scan);
  assert.deepEqual(selection.errors, []);
  const { catalog, sources } = await readMemorySources(
    decisionsDirectory,
    selection.relativePaths
  );

  const filesystemSnapshot = await readDecisionStateSnapshot(
    decisionsDirectory,
    selection.relativePaths
  );
  const memorySnapshot = await buildDecisionStateSnapshotFromSources(
    catalog,
    sources
  );
  assert.deepEqual(memorySnapshot, filesystemSnapshot);
  assert.equal(
    memorySnapshot.revision,
    decisionSourceRevision(catalog, sources)
  );

  const filesystemIndex = await buildDecisionIndexFromSnapshot(filesystemSnapshot);
  const reversedMemorySnapshot = await buildDecisionStateSnapshotFromSources(
    catalog,
    [...sources].reverse()
  );
  const memoryIndex = await buildDecisionIndexFromSnapshot(
    reversedMemorySnapshot
  );
  assert.equal(filesystemIndex.status, "ok");
  assert.equal(memoryIndex.status, "ok");
  assert.equal(
    serializeDecisionIndex(filesystemIndex.value),
    serializeDecisionIndex(memoryIndex.value)
  );
  })
));

test("memory source snapshots ignore same-name filesystem relation targets", () => (
  withFixtureWorkspace("memory-snapshot-targets", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const scan = await scanDecisionRecords({ workspaceRoot });
  const selection = selectDecisionIndexSourcePaths(scan);
  const { catalog, sources } = await readMemorySources(
    decisionsDirectory,
    selection.relativePaths
  );
  const withoutTarget = sources.filter(
    (source) => source.path !== "decision-records/260710-use-source-cli.md"
  );

  await assert.rejects(
    buildDecisionStateSnapshotFromSources(catalog, withoutTarget),
    /relationship 修订 target does not exist/
  );
  })
));

test("memory source snapshots reject active relationship targets", () => (
  withFixtureWorkspace("memory-snapshot-active-target", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const scan = await scanDecisionRecords({ workspaceRoot });
  const selection = selectDecisionIndexSourcePaths(scan);
  const { catalog, sources } = await readMemorySources(
    decisionsDirectory,
    selection.relativePaths
  );
  const targetPath = "decision-records/260710-use-source-cli.md";
  const activeTargetSources = sources.map((source) => source.path === targetPath
    ? {
        ...source,
        text: source.text
          .replace("status: archived", "status: active")
          .replace("alignment: null", "alignment: aligned")
      }
    : source);

  await assert.rejects(
    buildDecisionStateSnapshotFromSources(catalog, activeTargetSources),
    /relationship 修订 target must be archived/
  );
  })
));

test("memory source snapshots reject relationship cycles", () => (
  withFixtureWorkspace("memory-snapshot-cycle", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const scan = await scanDecisionRecords({ workspaceRoot });
  const selection = selectDecisionIndexSourcePaths(scan);
  const { catalog, sources } = await readMemorySources(
    decisionsDirectory,
    selection.relativePaths
  );
  const cycleSources = sources.map((source) => {
    if (source.path === currentRelativePath) {
      return {
        ...source,
        text: source.text
          .replace("status: active", "status: archived")
          .replace("alignment: aligned", "alignment: null")
      };
    }
    if (source.path === "decision-records/260710-use-source-cli.md") {
      return {
        ...source,
        text: source.text.replace(
          "relations: []",
          "relations:\n  - type: 修订\n    target: " + currentRelativePath
        )
      };
    }
    return source;
  });

  await assert.rejects(
    buildDecisionStateSnapshotFromSources(catalog, cycleSources),
    /Decision relations must not form a cycle/
  );
  })
));

async function readMemorySources(
  decisionsDirectory: string,
  relativePaths: readonly string[]
): Promise<{
  catalog: DecisionDomainCatalog;
  sources: DecisionSource[];
}> {
  const catalogText = await fs.readFile(
    path.join(decisionsDirectory, "decision-domains.json"),
    "utf8"
  );
  const parsedCatalog = parseDecisionDomainCatalog(
    catalogText,
    "decision-domains.json"
  );
  if (parsedCatalog.status === "error") {
    throw new Error(parsedCatalog.errors.join("; "));
  }
  return {
    catalog: parsedCatalog.value,
    sources: await Promise.all(relativePaths.map(async (relativePath) => ({
      path: relativePath,
      text: await fs.readFile(
        path.join(decisionsDirectory, ...relativePath.split("/")),
        "utf8"
      )
    })))
  };
}
