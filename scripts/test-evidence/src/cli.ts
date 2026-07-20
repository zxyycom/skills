import path from "node:path";
import { parseArgs } from "node:util";
import { validateTestEvidence } from "./validation.ts";

const helpText = `Usage: test-evidence [check] [options]

Review verification obligations, test-entry roles, scoped reviews, and unregistered entries.

Options:
  --root <path>     Target workspace root (default: current directory)
  --config <path>   Workspace-relative config path (default: .test-evidence.json)
  --json            Write one JSON report to stdout
  -h, --help        Show this help
`;

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: process.argv.slice(2),
      options: {
        config: { type: "string" },
        help: { short: "h", type: "boolean" },
        json: { type: "boolean" },
        root: { type: "string" }
      },
      strict: true
    });
  } catch (error) {
    failUsage(error instanceof Error ? error.message : String(error));
  }

  if (parsed.values.help === true) {
    process.stdout.write(helpText);
    return;
  }

  const command = parsed.positionals[0] ?? "check";
  if (command !== "check" || parsed.positionals.length > 1) {
    failUsage(`unsupported command or positional arguments: ${parsed.positionals.join(" ")}`);
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

  if (report.errors.length > 0) {
    process.exitCode = 1;
  }
}

function failUsage(message: string): never {
  console.error(`test-evidence: ${message}`);
  console.error(helpText.trimEnd());
  process.exit(2);
}

await main();
