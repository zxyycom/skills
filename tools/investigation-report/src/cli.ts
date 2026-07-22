#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { validateInvestigationReports } from "./validation.ts";

function printHelp(): void {
  console.log([
    "Usage: check-investigations.mjs [options]",
    "",
    "Check investigation topic files, self-contained reports, timestamps, and index projections.",
    "Without filters, every index entry and topic file is checked.",
    "",
    "Options:",
    "  --root <workspace-root>       Workspace root (default: current directory)",
    "  --investigations-dir <path>  Investigation root relative to workspace",
    "                               (default: docs/investigations)",
    "  --topic <topic-id>           Check one topic; repeatable",
    "  --report <relative-path>     Check one topic file path; repeatable",
    "  -h, --help                   Show this help"
  ].join("\n"));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}

export async function runInvestigationReportCheckCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: false,
      args: [...argv],
      options: {
        help: { short: "h", type: "boolean" },
        "investigations-dir": { type: "string" },
        report: { multiple: true, type: "string" },
        root: { type: "string" },
        topic: { multiple: true, type: "string" }
      },
      strict: true
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (parsed.values.help === true) {
    printHelp();
    return 0;
  }

  const result = await validateInvestigationReports({
    investigationsDir: optionalString(parsed.values["investigations-dir"]),
    reports: optionalStrings(parsed.values.report),
    topics: optionalStrings(parsed.values.topic),
    workspaceRoot: path.resolve(optionalString(parsed.values.root) ?? ".")
  });
  if (result.errors.length > 0) {
    console.error("Investigation report check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  console.log(
    "Investigation report check passed ("
    + result.selectedReportCount
    + " of "
    + result.availableReportCount
    + " topic files checked across "
    + result.topicCount
    + " topics)."
  );
  return 0;
}

export { validateInvestigationReports };
export type {
  InvestigationReportCheckOptions,
  InvestigationReportCheckResult,
  InvestigationReportStatus
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runInvestigationReportCheckCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
