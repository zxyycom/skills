import process from "node:process";
import { Command, CommanderError } from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { hasBlockingDiagnostics } from "./diagnostics.ts";
import {
  collectRegexTestEntries,
  type CollectRegexTestEntriesOptions
} from "./regex-collector.ts";
import {
  regexCollectorConfigSchema,
  regexDetectorSchema,
  testEntryInventorySchema
} from "./schemas.ts";

type RegexCollectorCliOptions = {
  config?: string;
  root: string;
};

export async function runRegexCollectorCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let exitCode = 0;
  const program = new Command()
    .name("test-entry-regex")
    .description(
      "Collect test entries and @test-evidence markers into a schema-validated inventory."
    )
    .option("--root <path>", "Target workspace root.", process.cwd())
    .option(
      "--config <path>",
      "Workspace-relative collector config (default: .test-entry-regex.json)."
    )
    .showHelpAfterError()
    .addHelpText(
      "afterAll",
      "\nWrites one TestEntryInventory JSON document to stdout. Exit codes: "
        + "0 collected without blocking diagnostics, 1 blocking diagnostics, "
        + "2 invalid arguments."
    )
    .exitOverride()
    .action(async (options: RegexCollectorCliOptions) => {
      const inventory = await collectRegexTestEntries({
        configPath: options.config,
        workspaceRoot: options.root
      });
      process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
      exitCode = hasBlockingDiagnostics(inventory.diagnostics) ? 1 : 0;
    });

  try {
    await program.parseAsync(["node", "test-entry-regex.mjs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }
    throw error;
  }
  return exitCode;
}

export {
  collectRegexTestEntries,
  regexCollectorConfigSchema,
  regexDetectorSchema,
  testEntryInventorySchema
};
export type { CollectRegexTestEntriesOptions };
export type {
  RegexCollectorConfig,
  RegexDetector,
  TestEntry,
  TestEntryInventory,
  TestEntryMarker,
  TestEvidenceDiagnostic
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runRegexCollectorCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
