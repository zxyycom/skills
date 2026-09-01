import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGitRepositoryFixture } from "../../shared/tests/git-fixture.ts";

const fixtureSourceRoot = path.join(import.meta.dirname, "fixtures", "staging");
const fixtureNames = [
  "catalog-a",
  "catalog-a-b",
  "catalog-a-b-c",
  "readme"
] as const;

export type StagingFixtureName = (typeof fixtureNames)[number];

type StagingFixtureTemplate = Readonly<{
  repositoryRoot: string;
}>;

export type StagingFixtureTemplates = Readonly<{
  root: string;
  scenarios: Readonly<Record<StagingFixtureName, StagingFixtureTemplate>>;
}>;

/**
 * Builds private template repositories from checked-in ordinary fixture trees.
 * Consumers receive independent private copies, so staged indexes and worktrees
 * can never share mutable Git state with another staging case.
 */
export async function bootstrapStagingFixtureTemplates(): Promise<StagingFixtureTemplates> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-stage-fixtures-")
  );
  try {
    const scenarios = {} as Record<StagingFixtureName, StagingFixtureTemplate>;
    for (const name of fixtureNames) {
      scenarios[name] = await bootstrapFixtureTemplate(root, name);
    }
    return { root, scenarios };
  } catch (error) {
    await fs.rm(root, { force: true, recursive: true });
    throw error;
  }
}

export async function removeStagingFixtureTemplates(
  templates: StagingFixtureTemplates
): Promise<void> {
  await fs.rm(templates.root, { force: true, recursive: true });
}

export async function withStagingGitFixture<T>(
  templates: StagingFixtureTemplates,
  name: StagingFixtureName,
  operation: (repositoryRoot: string) => Promise<T>
): Promise<T> {
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `test-evidence-stage-${name}-`)
  );
  const repositoryRoot = path.join(temporaryRoot, "repository");
  const template = templates.scenarios[name];
  try {
    await fs.cp(template.repositoryRoot, repositoryRoot, { recursive: true });
    await assertIndependentWorkspace(repositoryRoot, template.repositoryRoot);
    return await operation(repositoryRoot);
  } finally {
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  }
}

export function runGit(
  repositoryRoot: string,
  arguments_: readonly string[]
): string {
  return execFileSync("git", ["-C", repositoryRoot, ...arguments_], {
    encoding: "utf8",
    windowsHide: true
  });
}

async function bootstrapFixtureTemplate(
  templatesRoot: string,
  name: StagingFixtureName
): Promise<StagingFixtureTemplate> {
  const sourceRoot = path.join(fixtureSourceRoot, name);
  const fixture = await createGitRepositoryFixture({
    fixtureRoot: sourceRoot,
    parentDirectory: templatesRoot,
    repositoryName: name,
    userEmail: "test@example.com",
    userName: "Test Evidence staging fixture"
  });
  return { repositoryRoot: fixture.repositoryRoot };
}

async function assertIndependentWorkspace(
  repositoryRoot: string,
  templateRepositoryRoot: string
): Promise<void> {
  const workspaceGitDirectory = await fs.realpath(
    path.join(repositoryRoot, ".git")
  );
  const templateGitDirectory = await fs.realpath(
    path.join(templateRepositoryRoot, ".git")
  );
  if (workspaceGitDirectory === templateGitDirectory) {
    throw new Error(
      "Fixture workspace shares mutable Git metadata with its template."
    );
  }
}
