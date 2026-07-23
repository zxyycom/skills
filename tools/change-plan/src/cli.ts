#!/usr/bin/env node

import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { checkChangePlanDirectory } from "./check.ts";

function helpText(): string {
  return [
    "Usage: change-plan.mjs check <change-directory> [--json]",
    "",
    "Check the fixed proposal.md, design.md, and tasks.md structure of one change plan.",
    "The checker validates structure only; it does not approve the plan or judge correctness.",
    "",
    "Options:",
    "  --json       Write the structured result to stdout",
    "  -h, --help   Show this help"
  ].join("\n");
}

function formatDiagnostic(
  diagnostic: Awaited<ReturnType<typeof checkChangePlanDirectory>>["diagnostics"][number]
): string {
  const location = diagnostic.file === null
    ? ""
    : `${diagnostic.file}${diagnostic.line === undefined ? "" : `:${diagnostic.line}`}: `;
  return `- ${location}[${diagnostic.code}] ${diagnostic.message}`;
}

export async function runChangePlanCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        help: { short: "h", type: "boolean" },
        json: { type: "boolean" }
      },
      strict: true
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (parsed.values.help === true) {
    console.log(helpText());
    return 0;
  }
  if (
    parsed.positionals.length !== 2
    || parsed.positionals[0] !== "check"
    || parsed.positionals[1].trim().length === 0
  ) {
    console.error("Expected: change-plan.mjs check <change-directory> [--json]");
    return 2;
  }

  const result = await checkChangePlanDirectory(parsed.positionals[1]);
  if (parsed.values.json === true) {
    console.log(JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  if (!result.valid) {
    console.error(`Change plan check failed (${result.changeDirectory}):`);
    for (const diagnostic of result.diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }
    return 1;
  }

  console.log(
    `Change plan check passed (${result.changeName}; `
    + `${result.completedTaskCount}/${result.taskCount} tasks completed).`
  );
  return 0;
}

export { checkChangePlanDirectory };
export type {
  ChangePlanArtifactName,
  ChangePlanCheckResult,
  ChangePlanDiagnostic,
  ChangePlanDiagnosticCode
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runChangePlanCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
