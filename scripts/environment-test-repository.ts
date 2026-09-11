import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createGitRepositoryFixture } from "../tools/shared/tests/git-fixture.ts";
import {
  requireSuccess,
  run,
  workspaceRoot
} from "./environment-test-process.ts";

const environmentRepositoryFixtureRoot = path.join(
  workspaceRoot,
  "scripts",
  "fixtures",
  "environment-repository"
);

export const gitCommitConfig = [
  "-c",
  "user.email=environment@example.invalid",
  "-c",
  "user.name=Environment Test"
];
export const repositoryHookNames = ["pre-commit", "post-commit"] as const;

async function populateRepository(root: string): Promise<void> {
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  for (const script of [
    "environment-command.js",
    "environment-config.js",
    "environment-output.js",
    "environment-setup.js",
    "environment-status.js",
    "environment.js",
    "setup-git-hooks.js",
    "setup-repository.js",
    "task-graph.js"
  ]) {
    await fs.copyFile(
      path.join(workspaceRoot, "scripts", script),
      path.join(root, "scripts", script)
    );
  }
}

export async function createRepository(
  parent: string,
  name: string
): Promise<string> {
  const fixture = await createGitRepositoryFixture({
    fixtureRoot: environmentRepositoryFixtureRoot,
    parentDirectory: parent,
    prepareRepository: populateRepository,
    repositoryName: name,
    userEmail: "environment@example.invalid",
    userName: "Environment Test"
  });
  return fixture.repositoryRoot;
}

async function copyRepositoryPath(
  relativePath: string,
  targetRoot: string
): Promise<void> {
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
}

export async function createHashHookRepository(
  parent: string,
  name: string
): Promise<string> {
  const root = path.join(parent, name);
  await fs.mkdir(root, { recursive: true });
  for (const relativePath of [
    "scripts/hash-skills.ts",
    "scripts/lib/oxc-config.ts",
    "scripts/lib/project.ts",
    "scripts/lib/skill-package-hash.ts",
    "scripts/lib/skill-package-release.ts",
    "scripts/lib/skill-package-tree.ts",
    "scripts/lib/skill-package-version-baseline.ts",
    "scripts/lib/skill-package-versioning.ts",
    "tools/shared/src/markdown/frontmatter.ts",
    "tools/shared/src/node/error-detail.ts",
    "tools/shared/src/node/filesystem.ts",
    "tools/shared/src/version-control",
    "tools/skill-package/src/release-manifest.ts",
    "tools/skill-package/src/version.ts"
  ]) {
    await copyRepositoryPath(relativePath, root);
  }

  await fs.mkdir(path.join(root, ".githooks"), { recursive: true });
  const hookSource = await fs.readFile(
    path.join(workspaceRoot, ".githooks", "pre-commit"),
    "utf8"
  );
  await fs.writeFile(
    path.join(root, ".githooks", "pre-commit"),
    `${hookSource.trimEnd()}\nprintf 'executed\\n' > .hash-hook-ran\n`,
    "utf8"
  );
  await fs.chmod(path.join(root, ".githooks", "pre-commit"), 0o755);
  await fs.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        scripts: { "hash:skills": "bun scripts/hash-skills.ts" },
        type: "module"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(root, ".gitignore"),
    "node_modules/\n.hash-hook-ran\n",
    "utf8"
  );
  await fs.mkdir(path.join(root, "skills", "alpha"), { recursive: true });
  await fs.writeFile(
    path.join(root, "skills", "alpha", "SKILL.md"),
    [
      "---",
      "name: alpha",
      "description: Linked worktree hook regression fixture.",
      "metadata:",
      '  version: "1"',
      "---",
      "",
      "# Alpha",
      ""
    ].join("\n"),
    "utf8"
  );

  requireSuccess(run("git", ["init", "-b", "main"], root), "git init");
  requireSuccess(run("git", ["add", "."], root), "git add");
  requireSuccess(
    run(
      "git",
      [...gitCommitConfig, "commit", "--no-verify", "-m", "fixture"],
      root
    ),
    "git commit"
  );
  return root;
}

export function commandPaths(command: string): readonly string[] {
  const locator = process.platform === "win32" ? "where" : "which";
  const args = process.platform === "win32" ? [command] : ["-a", command];
  const result = run(locator, args, workspaceRoot);
  requireSuccess(result, `${locator} ${command}`);
  const paths = result.stdout
    .split(/\r?\n/u)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
  assert.ok(paths.length > 0, `${locator} ${command} returned no path`);
  return paths;
}

export function assertHookExecutes(root: string): void {
  const result = run(
    "git",
    [...gitCommitConfig, "commit", "--allow-empty", "-m", "hook check"],
    root
  );
  assert.notEqual(result.status, 0, "the fixture hook must block the commit");
}

export async function assertHooksAreUsable(root: string): Promise<void> {
  for (const hookName of repositoryHookNames) {
    const hook = await fs.stat(path.join(root, ".githooks", hookName));
    assert.equal(hook.isFile(), true);
    if (process.platform !== "win32") assert.notEqual(hook.mode & 0o111, 0);
  }
}
