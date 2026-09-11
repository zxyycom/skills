import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import type { ReadonlyStateIndex, StateIndexDefinition } from "../src/index.ts";
import { parseStateIndex } from "../src/index.ts";
import { resultValue } from "./support.ts";
import {
  indexPath,
  type TestMetadata,
  type TestState
} from "./staging-fixture.ts";

export function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", "staging@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Index Staging Test"]);
}

export function pendingConflictDiagnostic(detail: string) {
  return {
    code: "state-index.pending-conflict",
    message:
      "the current revision or target pending content changed; reread the current " +
      "revision and target pending content, resolve any existing pending change for " +
      "this index, then retry",
    path: indexPath,
    stateId: null,
    versionControl: {
      causeCategory: "unknown",
      detail,
      operation: "verify a pending replacement",
      target: indexPath
    }
  };
}

export function runGit(
  workingDirectory: string,
  args: readonly string[]
): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

export async function writeFile(
  rootDirectory: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(rootDirectory, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

export async function readPendingIndex(
  repositoryRoot: string,
  definition: StateIndexDefinition<TestState, TestMetadata>
) {
  return resultValue(
    parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "staging-test" },
      sourcePath: indexPath,
      text: await pendingIndexText(repositoryRoot)
    })
  );
}

export async function pendingIndexText(
  repositoryRoot: string
): Promise<string> {
  const files = await (
    await openVersionControl(repositoryRoot)
  ).readPendingFiles({
    pathScopes: [indexPath]
  });
  assert.equal(files.length, 1);
  return Buffer.from(files[0]!.data).toString("utf8");
}

export async function readPendingText(
  repositoryRoot: string,
  pathScope: string
): Promise<Array<{ data: string; path: string }>> {
  const files = await (
    await openVersionControl(repositoryRoot)
  ).readPendingFiles({
    pathScopes: [pathScope]
  });
  return files.map((file) => ({
    data: Buffer.from(file.data).toString("utf8"),
    path: file.path
  }));
}

export async function pendingChangedPaths(
  repositoryRoot: string
): Promise<string[]> {
  const repository = await openVersionControl(repositoryRoot);
  const revision = await repository.getCurrentRevision();
  assert.notEqual(revision, null);
  return await repository.listPendingChangedPaths({ from: revision! });
}

export function entryLabels(
  index: ReadonlyStateIndex<TestState, TestMetadata>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(index.entries).map(([id, entry]) => [id, entry.label])
  );
}
