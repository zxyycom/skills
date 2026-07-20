import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../lib/main-module.ts";
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

export async function runSkillValidatorCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        help: { short: "h", type: "boolean" }
      },
      strict: true
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (parsed.values.help) {
    printHelp();
    return 0;
  }
  if (parsed.positionals.length > 1) {
    console.error("Expected at most one skill-directory argument.");
    return 2;
  }

  const skillDirectory = path.resolve(parsed.positionals[0] ?? ".");
  const result = await validateSkillDirectory(skillDirectory);
  if (result.errors.length > 0) {
    console.error(`Skill structure validation failed: ${result.skillDirectory}`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  console.log(
    `Skill structure validation passed: ${result.skillDirectory} `
    + `(${result.markdownFileCount} markdown files checked).`
  );
  return 0;
}

export { validateSkillDirectory };
export type {
  SkillStructureValidationOptions,
  SkillStructureValidationResult
} from "./validation.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runSkillValidatorCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
