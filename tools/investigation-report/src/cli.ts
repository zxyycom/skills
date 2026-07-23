#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  investigationTopicSelectionOptionErrors,
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "./validation.ts";
import {
  investigationIndexQueryOptionErrors,
  queryInvestigationIndex
} from "./query.ts";
import {
  investigationReportStatuses,
  type InvestigationReportStatus
} from "./types.ts";

function printHelp(): void {
  console.log([
    "Usage: check-investigations.mjs [check] [options]",
    "       check-investigations.mjs sync-index [options]",
    "       check-investigations.mjs list [options]",
    "",
    "Check investigation topics, their self-contained reports, timestamps, and the generated index.",
    "Without filters, every topic and full-index freshness are checked.",
    "With --category or --path, only matching topic structure is checked.",
    "sync-index validates every topic and writes the derived JSON index.",
    "list checks index freshness, then queries topic state without parsing report bodies.",
    "",
    "Options:",
    "  --root <workspace-root>       Workspace root (default: current directory)",
    "  --investigations-dir <path>  Investigation root relative to workspace",
    "                               (default: docs/investigations)",
    "  --category <category-id>     Filter one topic category in check or list; repeatable",
    "  --path <relative-path>       Filter one topic path in check or list; repeatable",
    "  --status <status>            List one status; repeatable",
    "  --text <terms>               List topic titles, questions, or report titles containing all terms",
    "  --latest-from <timestamp>    List topics whose latest report is at or after this timestamp",
    "  --latest-to <timestamp>      List topics whose latest report is at or before this timestamp",
    "  --limit <count>              List page size (default: 50, maximum: 1000)",
    "  --offset <count>             List page offset (default: 0)",
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

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "string" ? Number(value) : undefined;
}

function isInvestigationReportStatus(
  value: string
): value is InvestigationReportStatus {
  return investigationReportStatuses.some((status) => status === value);
}

export async function runInvestigationReportCheckCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        category: { multiple: true, type: "string" },
        help: { short: "h", type: "boolean" },
        "investigations-dir": { type: "string" },
        "latest-from": { type: "string" },
        "latest-to": { type: "string" },
        limit: { type: "string" },
        offset: { type: "string" },
        path: { multiple: true, type: "string" },
        root: { type: "string" },
        status: { multiple: true, type: "string" },
        text: { type: "string" }
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

  if (parsed.positionals.length > 1) {
    console.error("expected at most one command: check, sync-index, or list");
    return 2;
  }
  const command = parsed.positionals[0] ?? "check";
  if (
    command !== "check"
    && command !== "sync-index"
    && command !== "list"
  ) {
    console.error(`unknown command: ${command}`);
    return 2;
  }

  const investigationsDir = optionalString(
    parsed.values["investigations-dir"]
  );
  const workspaceRoot = path.resolve(optionalString(parsed.values.root) ?? ".");
  const hasListOnlyOptions = [
    parsed.values["latest-from"],
    parsed.values["latest-to"],
    parsed.values.limit,
    parsed.values.offset,
    parsed.values.status,
    parsed.values.text
  ].some((value) => value !== undefined);
  if (command === "sync-index") {
    if (
      optionalStrings(parsed.values.category) !== undefined
      || optionalStrings(parsed.values.path) !== undefined
      || hasListOnlyOptions
    ) {
      console.error("sync-index does not accept query filters or pagination");
      return 2;
    }
    const synchronized = await synchronizeInvestigationIndex({
      investigationsDir,
      workspaceRoot
    });
    if (synchronized.errors.length > 0) {
      console.error("Investigation index synchronization failed:");
      for (const error of synchronized.errors) {
        console.error(`- ${error}`);
      }
      return 1;
    }
    console.log(
      synchronized.changed
        ? "Investigation index synchronized "
          + `(${synchronized.topicCount} topics across `
          + `${synchronized.categoryCount} categories).`
        : "Investigation index is already current "
          + `(${synchronized.topicCount} topics across `
          + `${synchronized.categoryCount} categories).`
    );
    return 0;
  }

  if (command === "list") {
    const statusValues = optionalStrings(parsed.values.status);
    const invalidStatuses = (statusValues ?? []).filter((status) => (
      !isInvestigationReportStatus(status)
    ));
    if (invalidStatuses.length > 0) {
      console.error(
        `unknown investigation status: ${invalidStatuses.join(", ")}`
      );
      return 2;
    }
    const queryOptions = {
      categories: optionalStrings(parsed.values.category),
      investigationsDir,
      latestReportAtFrom: optionalString(parsed.values["latest-from"]),
      latestReportAtTo: optionalString(parsed.values["latest-to"]),
      limit: optionalNumber(parsed.values.limit),
      offset: optionalNumber(parsed.values.offset),
      paths: optionalStrings(parsed.values.path),
      statuses: statusValues?.filter(isInvestigationReportStatus),
      text: optionalString(parsed.values.text),
      workspaceRoot
    };
    const optionErrors = investigationIndexQueryOptionErrors(queryOptions);
    if (optionErrors.length > 0) {
      console.error("Invalid investigation topic query options:");
      for (const error of optionErrors) {
        console.error(`- ${error}`);
      }
      return 2;
    }
    const queried = await queryInvestigationIndex(queryOptions);
    if (queried.errors.length > 0) {
      console.error("Investigation index query failed:");
      for (const error of queried.errors) {
        console.error(`- ${error}`);
      }
      return 1;
    }
    if (queried.entries.length === 0) {
      console.log("No investigation topics matched.");
      return 0;
    }
    console.log(
      `Investigation topics (${queried.entries.length} of ${queried.total}, `
      + `offset ${queried.offset}):`
    );
    for (const entry of queried.entries) {
      console.log(`${entry.status} ${entry.latestReportAt} ${entry.path}`);
      console.log(`  title: ${entry.title}`);
      console.log(`  question: ${entry.question}`);
      console.log(
        `  reports: ${entry.reportCount}; latest: ${entry.reportTitles.at(-1)}`
      );
    }
    return 0;
  }

  if (hasListOnlyOptions) {
    console.error(
      "check only accepts --category and --path filters; "
      + "use list for indexed queries"
    );
    return 2;
  }
  const checkOptions = {
    categories: optionalStrings(parsed.values.category),
    investigationsDir,
    paths: optionalStrings(parsed.values.path),
    workspaceRoot
  };
  const optionErrors = investigationTopicSelectionOptionErrors(checkOptions);
  if (optionErrors.length > 0) {
    console.error("Invalid investigation topic check options:");
    for (const error of optionErrors) {
      console.error(`- ${error}`);
    }
    return 2;
  }
  const result = await validateInvestigationReports(checkOptions);
  if (result.errors.length > 0) {
    console.error("Investigation report check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  console.log(
    "Investigation report check passed ("
    + result.selectedTopicCount
    + " of "
    + result.availableTopicCount
    + " topics checked across "
    + result.categoryCount
    + " categories"
    + (result.indexChecked ? "; full index current" : "; index not checked")
    + ")."
  );
  return 0;
}

export {
  queryInvestigationIndex,
  synchronizeInvestigationIndex,
  validateInvestigationReports
};
export type {
  InvestigationIndexQueryOptions,
  InvestigationIndexQueryResult,
  InvestigationIndexState,
  InvestigationIndexSyncOptions,
  InvestigationIndexSyncResult,
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
