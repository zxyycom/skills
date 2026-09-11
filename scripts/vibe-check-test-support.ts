import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { defineCheck, defineConfig, run } from "@zxyycom/vibe-check";
import type { Check, ProjectDefinition, RunResult } from "@zxyycom/vibe-check";
import {
  vibeNativeCheckIds,
  type GateCommandInvocation,
  type GateCommandRunner
} from "./lib/vibe-gate.ts";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export const aggregateOptions = {
  checks: "all",
  empty: "failed",
  mode: "all",
  notApplicable: "fail",
  unavailable: "fail"
} as const;

export const noOutput = {
  diagnosticLogging: { enabled: false },
  machinePublication: { enabled: false },
  progressRendering: { enabled: false }
} as const;

export function scriptForCommand(
  invocation: GateCommandInvocation
): string | null {
  return invocation.command === "bun" && invocation.args[0] === "run"
    ? (invocation.args[1] ?? null)
    : null;
}

export async function withTemporaryDirectory<T>(
  prefix: string,
  operation: (directory: string) => Promise<T>
): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await operation(directory);
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

export function runGit(directory: string, args: readonly string[]): void {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`
  );
}

export function skillMarkdown(version: number, body: string): string {
  return [
    "---",
    "name: alpha",
    "metadata:",
    `  version: "${version}"`,
    "---",
    "",
    body,
    ""
  ].join("\n");
}

export async function createReleaseRepository(
  directory: string,
  version: number = 1,
  body: string = "base"
): Promise<string> {
  const skillDirectory = path.join(directory, "skills", "alpha");
  await fs.mkdir(skillDirectory, { recursive: true });
  await fs.writeFile(
    path.join(skillDirectory, "SKILL.md"),
    skillMarkdown(version, body)
  );
  runGit(directory, ["init", "--quiet"]);
  runGit(directory, ["config", "user.email", "skills@example.test"]);
  runGit(directory, ["config", "user.name", "Skills Test"]);
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "--quiet", "--message", "base"]);
  return skillDirectory;
}

export async function stageSkillMarkdown(
  directory: string,
  version: number,
  body: string
): Promise<void> {
  await fs.writeFile(
    path.join(directory, "skills", "alpha", "SKILL.md"),
    skillMarkdown(version, body)
  );
  runGit(directory, ["add", "skills/alpha/SKILL.md"]);
}

export async function zipSkillMarkdown(directory: string): Promise<string> {
  return await zipSkillMarkdownFor(directory, "alpha");
}

export async function zipSkillMarkdownFor(
  directory: string,
  skillName: string
): Promise<string> {
  const archive = unzipSync(
    await fs.readFile(path.join(directory, "dist", `${skillName}.zip`))
  );
  const contents = archive[`${skillName}/SKILL.md`];
  assert.ok(contents);
  return Buffer.from(contents).toString("utf8");
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

export async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!(await fileExists(filePath))) {
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for ${filePath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export function completed(result: RunResult) {
  if (result.kind === "completed") {
    return result;
  }
  throw new Error("expected a completed Vibe result");
}

export async function runDefinition(
  definition: ProjectDefinition,
  projectRoot: string,
  flags: readonly string[] = [],
  signal: AbortSignal = new AbortController().signal
) {
  return completed(
    await run(definition, {
      checkAggregation: { ...aggregateOptions, checks: "effective" },
      flags,
      outputs: noOutput,
      projectRoot,
      signal
    })
  );
}

export function outcomeFor(
  result: ReturnType<typeof completed>,
  checkId: string
) {
  const check = result.snapshot.checks.find(
    (candidate) => candidate.checkId === checkId
  );
  if (!check) {
    throw new Error(`missing Check outcome for ${checkId}`);
  }
  return check.outcome;
}

export function releaseTerminalCheck(definition: ProjectDefinition): Check {
  const check = definition.checks.find(
    ({ checkId }) => checkId === "pack:skills"
  );
  if (!check) {
    throw new Error("missing release terminal Check");
  }
  return check;
}

export function passingNativeChecks(): readonly Check[] {
  return vibeNativeCheckIds.map((checkId) =>
    defineCheck({
      checkId,
      displayName: checkId,
      execution() {
        return { status: "passed", data: { checkId } };
      }
    })
  );
}

export function completedScript(exitCode = 0, output = ""): GateCommandRunner {
  return async () => ({ exitCode, output, status: "completed" });
}

export type NativeBlockingCheckFixture = Readonly<{
  readonly check: Check;
  readonly introduceFinding: (directory: string) => Promise<void>;
  readonly prefix: string;
  readonly setup: (directory: string) => Promise<void>;
}>;

export async function assertNativeBlockingCheckContract(
  fixture: NativeBlockingCheckFixture
): Promise<void> {
  await withTemporaryDirectory(fixture.prefix, async (directory) => {
    await fixture.setup(directory);
    runGit(directory, ["init"]);
    runGit(directory, ["add", "."]);
    const definition = defineConfig({
      checks: [fixture.check],
      outputs: noOutput
    });

    const passed = await runDefinition(definition, directory);
    assert.equal(passed.aggregate, "passed");
    assert.equal(passed.snapshot.checks[0]?.outcome.status, "passed");

    await fixture.introduceFinding(directory);
    runGit(directory, ["add", "."]);
    const failed = await runDefinition(definition, directory);
    assert.equal(failed.aggregate, "failed");
    assert.equal(failed.snapshot.checks[0]?.outcome.status, "failed");

    const unavailable = await runDefinition(
      definition,
      path.join(directory, "missing-root")
    );
    assert.equal(unavailable.aggregate, "failed");
    assert.equal(unavailable.snapshot.checks[0]?.outcome.status, "unavailable");
  });
}
