import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  defaultTaskGraphIndexPath,
  parseTaskIndex,
  runTaskGraphCli,
  serializeTaskIndex,
  type TaskIndex
} from "../src/cli.ts";
import {
  applyOperations,
  graphIndex,
  taskContent,
  taskOperation
} from "./helpers.ts";

type RepositoryFixture = {
  candidateText: string;
};

export function baseIndex(): TaskIndex {
  return graphIndex([
    taskOperation("alpha", { title: "alpha baseline" }),
    taskOperation("bravo", { title: "bravo baseline" })
  ]);
}

export function updateTitle(
  index: TaskIndex,
  taskId: string,
  title: string
): TaskIndex {
  return applyOperations(index, [
    {
      kind: "update-task-content",
      taskId,
      content: taskContent(title)
    }
  ]);
}

export async function createRepositoryFixture(options: {
  baseline: TaskIndex;
  candidate: TaskIndex;
  repositoryRoot: string;
  stageOutside?: boolean;
}): Promise<RepositoryFixture> {
  initializeRepository(options.repositoryRoot);
  await writeFile(
    options.repositoryRoot,
    defaultTaskGraphIndexPath,
    serializeTaskIndex(options.baseline)
  );
  await writeFile(
    options.repositoryRoot,
    "outside/keep.md",
    "outside baseline\n"
  );
  runGit(options.repositoryRoot, ["add", "."]);
  runGit(options.repositoryRoot, ["commit", "--quiet", "--message", "base"]);

  const candidateText = serializeTaskIndex(options.candidate);
  await writeFile(
    options.repositoryRoot,
    defaultTaskGraphIndexPath,
    candidateText
  );
  if (options.stageOutside === true) {
    await writeFile(
      options.repositoryRoot,
      "outside/keep.md",
      "outside pending\n"
    );
    runGit(options.repositoryRoot, ["add", "outside/keep.md"]);
  }
  return {
    candidateText
  };
}

export function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, [
    "config",
    "user.email",
    "task-stage@example.invalid"
  ]);
  runGit(repositoryRoot, ["config", "user.name", "Task Stage Test"]);
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

export async function readPendingTaskIndex(
  repositoryRoot: string
): Promise<TaskIndex> {
  return parseTaskIndex(
    JSON.parse(
      await readPendingText(repositoryRoot, defaultTaskGraphIndexPath)
    ) as unknown
  );
}

export async function readPendingText(
  repositoryRoot: string,
  filePath: string
): Promise<string> {
  const files = await (
    await openVersionControl(repositoryRoot)
  ).readPendingFiles({
    pathScopes: [filePath]
  });
  assert.equal(files.length, 1);
  const [file] = files;
  if (file === undefined) assert.fail(`Pending file is missing: ${filePath}`);
  return Buffer.from(file.data).toString("utf8");
}

export async function pendingChangedPaths(
  repositoryRoot: string
): Promise<string[]> {
  const repository = await openVersionControl(repositoryRoot);
  const revision = await repository.getCurrentRevision();
  if (revision === null) assert.fail("Test repository has no HEAD revision");
  return await repository.listPendingChangedPaths({ from: revision });
}

export function resetPendingPath(repositoryRoot: string): void {
  runGit(repositoryRoot, [
    "reset",
    "--quiet",
    "HEAD",
    "--",
    defaultTaskGraphIndexPath
  ]);
}

export async function callCli(
  repositoryRoot: string,
  args: string[]
): Promise<{ exitCode: number; output: string }> {
  const chunks: string[] = [];
  const exitCode = await runTaskGraphCli(["--root", repositoryRoot, ...args], {
    io: { stdout: (text) => chunks.push(text) }
  });
  assert.equal(chunks.length, 1);
  const [output] = chunks;
  if (output === undefined) assert.fail("CLI did not write a result");
  return { exitCode, output };
}
