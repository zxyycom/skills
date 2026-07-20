import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { validateSkillDirectory } from "./validation.ts";

function printHelp(): void {
  console.log([
    "Usage: validate-skill.mjs [skill-directory]",
    "",
    "Validate the portable structure contract of a Codex skill.",
    "The current directory is used when skill-directory is omitted.",
    "",
    "Options:",
    "  -h, --help  Show this help"
  ].join("\n"));
}

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: process.argv.slice(2),
      options: {
        help: { short: "h", type: "boolean" }
      },
      strict: true
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }

  if (parsed.values.help) {
    printHelp();
    return;
  }
  if (parsed.positionals.length > 1) {
    console.error("Expected at most one skill-directory argument.");
    process.exitCode = 2;
    return;
  }

  const skillDirectory = path.resolve(parsed.positionals[0] ?? ".");
  const result = await validateSkillDirectory(skillDirectory);
  if (result.errors.length > 0) {
    console.error(`Skill structure validation failed: ${result.skillDirectory}`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Skill structure validation passed: ${result.skillDirectory} `
    + `(${result.markdownFileCount} markdown files checked).`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
