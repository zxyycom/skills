import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  baseGateCheckIds,
  prepareGateActivation,
  publishGateReceipts,
  type GateActivationPlan
} from "./impact.ts";

export type ImpactTestCaptureDependencies = Readonly<{
  captureCommand: (
    command: string,
    arguments_: readonly string[],
    cwd: string
  ) => Promise<Buffer>;
  environment?: Readonly<Record<string, string | undefined>>;
}>;

export type ImpactTestFixture = Readonly<{
  cacheDirectory: string;
  captureDependencies: ImpactTestCaptureDependencies;
  directory: string;
  passedCheckIds: ReadonlySet<string>;
}>;

function runGit(directory: string, arguments_: readonly string[]): void {
  const result = spawnSync("git", arguments_, {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(
    result.status,
    0,
    `git ${arguments_.join(" ")} failed: ${result.stderr || result.stdout}`
  );
}

export async function captureFixtureCommand(
  command: string,
  arguments_: readonly string[],
  cwd: string
): Promise<Buffer> {
  if (command !== "git") {
    return Buffer.from(JSON.stringify([command, arguments_]));
  }
  const result = spawnSync(command, arguments_, { cwd, windowsHide: true });
  if (result.status !== 0 || result.stdout === null) {
    throw new Error(
      `git ${arguments_.join(" ")} failed: ${String(result.stderr)}`
    );
  }
  return result.stdout;
}

export async function writeImpactFixture(
  directory: string,
  relativePath: string,
  contents: string
): Promise<void> {
  const target = path.join(directory, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

export async function withImpactFixture(
  operation: (fixture: ImpactTestFixture) => Promise<void>
): Promise<void> {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills-gate-impact-")
  );
  try {
    await writeImpactFixture(directory, ".gitignore", ".log/\n");
    await writeImpactFixture(directory, "package.json", '{"private":true}\n');
    await writeImpactFixture(directory, "docs/README.md", "# Fixture\n");
    await writeImpactFixture(
      directory,
      "tools/change-plan/src/value.ts",
      "export const value = 1;\n"
    );
    await writeImpactFixture(
      directory,
      "tools/shared/src/value.ts",
      "export const shared = 1;\n"
    );
    runGit(directory, ["init", "--quiet"]);
    runGit(directory, ["config", "user.email", "skills@example.test"]);
    runGit(directory, ["config", "user.name", "Skills Test"]);
    runGit(directory, ["add", "."]);
    runGit(directory, ["commit", "--quiet", "--message", "fixture"]);
    await operation({
      cacheDirectory: path.join(directory, ".log", "gate-cache"),
      captureDependencies: { captureCommand: captureFixtureCommand },
      directory,
      passedCheckIds: new Set(baseGateCheckIds)
    });
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

export async function prepareFixtureActivation(
  fixture: ImpactTestFixture,
  captureDependencies: ImpactTestCaptureDependencies = fixture.captureDependencies
): Promise<GateActivationPlan> {
  return await prepareGateActivation({
    cacheDirectory: fixture.cacheDirectory,
    captureDependencies,
    release: false,
    workspaceRoot: fixture.directory
  });
}

export async function publishFixtureReceipts(
  fixture: ImpactTestFixture,
  plan: GateActivationPlan,
  passedCheckIds: ReadonlySet<string> = fixture.passedCheckIds,
  captureDependencies: ImpactTestCaptureDependencies = fixture.captureDependencies
) {
  return await publishGateReceipts(
    plan,
    passedCheckIds,
    fixture.directory,
    captureDependencies
  );
}

export async function publishInitialFixtureReceipts(
  fixture: ImpactTestFixture
): Promise<void> {
  const first = await prepareFixtureActivation(fixture);
  assert.equal(first.kind, "incremental");
  assert.equal(first.activeCheckIds.length, baseGateCheckIds.length);
  assert.ok(first.decisions.every(({ action }) => action === "execute"));
  assert.deepEqual(await publishFixtureReceipts(fixture, first), {
    published: true,
    receiptCount: 59
  });
}
