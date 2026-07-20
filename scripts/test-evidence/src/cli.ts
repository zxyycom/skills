import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../lib/main-module.ts";
import { validateTestEvidence } from "./validation.ts";

const helpText = `Usage: test-evidence [check] [options]

Review verification obligations, test-entry roles, scoped reviews, and unregistered entries.

Options:
  --root <path>     Target workspace root (default: current directory)
  --config <path>   Workspace-relative config path (default: .test-evidence.json)
  --json            Write one JSON report to stdout
  -h, --help        Show this help
`;

export async function runTestEvidenceCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        config: { type: "string" },
        help: { short: "h", type: "boolean" },
        json: { type: "boolean" },
        root: { type: "string" }
      },
      strict: true
    });
  } catch (error) {
    return failUsage(error instanceof Error ? error.message : String(error));
  }

  if (parsed.values.help === true) {
    process.stdout.write(helpText);
    return 0;
  }

  const command = parsed.positionals[0] ?? "check";
  if (command !== "check" || parsed.positionals.length > 1) {
    return failUsage(
      `unsupported command or positional arguments: ${parsed.positionals.join(" ")}`
    );
  }

  const configPath = typeof parsed.values.config === "string"
    ? parsed.values.config
    : undefined;
  const requestedRoot = typeof parsed.values.root === "string"
    ? parsed.values.root
    : process.cwd();
  const report = await validateTestEvidence({
    configPath,
    workspaceRoot: path.resolve(requestedRoot)
  });

  if (parsed.values.json === true) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const warning of report.warnings) {
      console.error(`warning: ${warning}`);
    }
    for (const error of report.errors) {
      console.error(`error: ${error}`);
    }
    const summary = report.summary;
    console.log(
      `Test evidence check ${report.errors.length === 0 ? "passed" : "failed"}: `
      + `${summary.activeAutomatedCases} automated, `
      + `${summary.reviewCases} review, ${summary.exemptCases} exempt, `
      + `${summary.plannedAutomatedCases} planned, `
      + `${summary.discoveredTestEntries} discovered test entry(s), `
      + `${summary.unregisteredTestEntries} unregistered, `
      + `${summary.reviewTriggers} review trigger(s).`
    );
  }

  return report.errors.length > 0 ? 1 : 0;
}

function failUsage(message: string): number {
  console.error(`test-evidence: ${message}`);
  console.error(helpText.trimEnd());
  return 2;
}

export { validateTestEvidence };
export type { ValidateTestEvidenceOptions } from "./validation.ts";
export type {
  ReviewTrigger,
  TestEvidenceReport,
  TestEvidenceSummary
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runTestEvidenceCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
