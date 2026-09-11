import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createGitRepositoryFixture } from "../../shared/tests/git-fixture.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const gitFixtureRoot = path.join(testsDirectory, "fixtures", "git-repository");
let gitFixtureTemplate: Promise<string> | null = null;
let gitFixtureTemplatePath: string | null = null;

after(async () => {
  if (gitFixtureTemplatePath !== null) {
    await fs.rm(gitFixtureTemplatePath, { force: true, recursive: true });
    gitFixtureTemplatePath = null;
  }
});

async function gitFixtureTemplateRoot(): Promise<string> {
  gitFixtureTemplate ??= createGitFixtureTemplate();
  try {
    return await gitFixtureTemplate;
  } catch (error) {
    gitFixtureTemplate = null;
    throw error;
  }
}

async function createGitFixtureTemplate(): Promise<string> {
  const templateParent = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-git-fixture-template-")
  );
  gitFixtureTemplatePath = templateParent;
  try {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: gitFixtureRoot,
      parentDirectory: templateParent,
      repositoryName: "repository",
      userEmail: "decision-records@example.invalid",
      userName: "Decision Records Test"
    });
    return fixture.repositoryRoot;
  } catch (error) {
    await fs.rm(templateParent, { force: true, recursive: true });
    gitFixtureTemplatePath = null;
    throw error;
  }
}

export async function withGitFixtureWorkspace<T>(
  label: string,
  operation: (workspaceRoot: string) => Promise<T>
): Promise<T> {
  const workspaceParent = await fs.mkdtemp(
    path.join(os.tmpdir(), `decision-records-${label}-`)
  );
  const workspaceRoot = path.join(workspaceParent, "workspace");
  try {
    await fs.cp(await gitFixtureTemplateRoot(), workspaceRoot, {
      recursive: true
    });
    return await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceParent, { force: true, recursive: true });
  }
}
