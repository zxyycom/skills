import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInvestigationReportCheckCli } from "../src/cli.ts";

export type InvestigationCliResult = Readonly<{
  status: number | null;
  stderr: string;
  stdout: string;
}>;

const generatedCliPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../skills/investigation-report/scripts/check-investigations.ts"
);

export function runGeneratedInvestigationCliSmoke(
  workspaceRoot: string,
  args: readonly string[]
): InvestigationCliResult {
  const result = spawnSync(
    "node",
    [generatedCliPath, ...args, "--root", workspaceRoot],
    { encoding: "utf8" }
  );
  assert.equal(
    result.error,
    undefined,
    `could not run generated investigation CLI with node: ${result.error?.message ?? "unknown spawn failure"}`
  );
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? ""
  };
}

export async function runInvestigationCli(
  workspaceRoot: string,
  args: readonly string[]
): Promise<InvestigationCliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io = {
    stderr: (text: string) => stderr.push(text),
    stdout: (text: string) => stdout.push(text)
  };
  const status = await runInvestigationReportCheckCli(
    [...args, "--root", workspaceRoot],
    { io }
  );
  return { status, stderr: stderr.join(""), stdout: stdout.join("") };
}
