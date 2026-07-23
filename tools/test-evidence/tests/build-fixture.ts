import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fixtureBranch,
  writeInitialFixtureWorkspace,
  writeReviewedFixtureCatalog
} from "./fixture-source.ts";
import { syncTestEvidenceIndex } from "../src/state-index.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  testsDirectory,
  "fixtures",
  "reviewed-workspace.bundle"
);
const mode = parseMode(process.argv.slice(2));
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-fixture-"));

try {
  const repositoryRoot = path.join(tempRoot, "repository");
  await fs.mkdir(repositoryRoot, { recursive: true });
  initializeGit(repositoryRoot);
  await writeInitialFixtureWorkspace(repositoryRoot);
  await syncFixtureIndex(repositoryRoot);
  const reviewedCommit = commitAll(
    repositoryRoot,
    "initial evidence",
    "2026-07-20T00:00:00Z"
  );
  await writeReviewedFixtureCatalog(repositoryRoot, reviewedCommit);
  await syncFixtureIndex(repositoryRoot);
  const fixtureHead = commitAll(
    repositoryRoot,
    "record completed review",
    "2026-07-20T00:01:00Z"
  );

  if (mode === "write") {
    await fs.mkdir(path.dirname(fixturePath), { recursive: true });
    runGit(repositoryRoot, [
      "bundle",
      "create",
      fixturePath,
      `refs/heads/${fixtureBranch}`
    ]);
    console.log(
      `Wrote test-evidence fixture ${path.relative(testsDirectory, fixturePath)} `
      + `at ${fixtureHead}.`
    );
  } else {
    const actualHead = readBundleHead(fixturePath);
    if (actualHead !== fixtureHead) {
      throw new Error(
        "Test-evidence Git fixture is stale; "
        + "run bun run sync:test-evidence-fixture."
      );
    }
    console.log("Test-evidence Git fixture is current.");
  }
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

async function syncFixtureIndex(repositoryRoot: string): Promise<void> {
  const result = await syncTestEvidenceIndex({
    mode: "write",
    workspaceRoot: repositoryRoot
  });
  if (result.status === "error") {
    throw new Error(
      `Could not build fixture test-evidence index: ${JSON.stringify(result.diagnostics)}`
    );
  }
}

function parseMode(args: readonly string[]): "check" | "write" {
  if (args.length === 1 && args[0] === "--check") {
    return "check";
  }
  if (args.length === 1 && args[0] === "--write") {
    return "write";
  }
  throw new Error("Usage: build-fixture.ts --check | --write");
}

function initializeGit(repositoryRoot: string): void {
  runGit(repositoryRoot, [
    "init",
    "-q",
    "--object-format=sha1",
    "-b",
    fixtureBranch
  ]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
}

function commitAll(
  repositoryRoot: string,
  message: string,
  timestamp: string
): string {
  runGit(repositoryRoot, ["add", "."]);
  runGit(
    repositoryRoot,
    [
      "-c",
      "core.hooksPath=.git/no-hooks",
      "-c",
      "user.email=test-evidence@example.invalid",
      "-c",
      "user.name=Test Evidence",
      "commit",
      "--no-gpg-sign",
      "--no-verify",
      "-qm",
      message
    ],
    {
      GIT_AUTHOR_DATE: timestamp,
      GIT_AUTHOR_EMAIL: "test-evidence@example.invalid",
      GIT_AUTHOR_NAME: "Test Evidence",
      GIT_COMMITTER_DATE: timestamp,
      GIT_COMMITTER_EMAIL: "test-evidence@example.invalid",
      GIT_COMMITTER_NAME: "Test Evidence"
    }
  );
  return runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
}

function readBundleHead(bundlePath: string): string {
  const output = execFileSync(
    "git",
    ["bundle", "list-heads", bundlePath, `refs/heads/${fixtureBranch}`],
    {
      encoding: "utf8",
      windowsHide: true
    }
  ).trim();
  const [head, reference, ...rest] = output.split(/\s+/u);
  if (
    head === undefined
    || reference !== `refs/heads/${fixtureBranch}`
    || rest.length > 0
  ) {
    throw new Error(`Unexpected test-evidence fixture head: ${output}`);
  }
  return head;
}

function runGit(
  repositoryRoot: string,
  args: readonly string[],
  additionalEnvironment: Readonly<Record<string, string>> = {}
): string {
  return execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...additionalEnvironment
    },
    windowsHide: true
  });
}
