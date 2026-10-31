import fs from "node:fs/promises";
import type { TestCommand } from "./snapshot-types.ts";
import {
  requireRegularProjectFile,
  snapshotFailure
} from "./snapshot-files.ts";

const testRunners: Readonly<Record<string, TestCommand["runner"]>> = {
  "bun\0test": "bun",
  "node\0--test": "node"
};

function commandTokens(command: string, scriptName: string): readonly string[] {
  const unsupportedCharacters = [
    "|",
    ";",
    "&",
    ">",
    "<",
    String.fromCharCode(96),
    "$",
    "\\",
    "\r",
    "\n"
  ];
  if (
    command.trim() !== command ||
    command.length === 0 ||
    unsupportedCharacters.some((character) => command.includes(character))
  ) {
    throw snapshotFailure(
      `test script ${scriptName} has an unsupported command shape`
    );
  }
  const tokens = command.split(" ");
  if (
    tokens.some(
      (token) =>
        token.length === 0 || token.includes('"') || token.includes("'")
    )
  ) {
    throw snapshotFailure(
      `test script ${scriptName} must use unquoted explicit file arguments`
    );
  }
  return tokens;
}

function parseTestSegment(
  segment: string,
  scriptName: string
): Omit<TestCommand, "original" | "scriptName"> {
  const tokens = commandTokens(segment, scriptName);
  const [command, option, ...rest] = tokens;
  const runner = testRunners[`${command}\0${option}`] ?? null;
  if (runner === null || rest.length === 0) {
    throw snapshotFailure(
      `test script ${scriptName} must be bun test <relative-file...> or node --test <relative-file...>`
    );
  }
  if (
    rest.some(
      (file) =>
        !file.startsWith("./") ||
        file === "./" ||
        file.includes("*") ||
        file.includes("?") ||
        file.includes("[") ||
        file.includes("]")
    )
  ) {
    throw snapshotFailure(
      `test script ${scriptName} must name explicit project-relative files`
    );
  }
  return { files: rest, runner };
}

export async function parseRepositoryTestCommands(
  workspaceRoot: string
): Promise<readonly TestCommand[]> {
  const manifestPath = await requireRegularProjectFile(
    workspaceRoot,
    "package.json",
    "package manifest"
  );
  let manifest: unknown;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    throw snapshotFailure(
      `package manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest) ||
    typeof (manifest as { scripts?: unknown }).scripts !== "object" ||
    (manifest as { scripts?: unknown }).scripts === null ||
    Array.isArray((manifest as { scripts?: unknown }).scripts)
  ) {
    throw snapshotFailure("package manifest scripts must be an object");
  }
  const scripts = (manifest as { scripts: Record<string, unknown> }).scripts;
  const commands: TestCommand[] = [];
  for (const scriptName of Object.keys(scripts)
    .filter((name) => name.startsWith("test:"))
    .sort()) {
    const original = scripts[scriptName];
    if (typeof original !== "string") {
      throw snapshotFailure(`test script ${scriptName} must be a string`);
    }
    const segments = original.split("&&").map((segment) => segment.trim());
    if (
      segments.length === 0 ||
      segments.some((segment) => segment.length === 0)
    ) {
      throw snapshotFailure(
        `test script ${scriptName} has an unsupported && sequence`
      );
    }
    for (const segment of segments) {
      const parsed = parseTestSegment(segment, scriptName);
      const uniqueFiles = [...new Set(parsed.files)];
      if (uniqueFiles.length !== parsed.files.length) {
        throw snapshotFailure(
          `test script ${scriptName} repeats a file target`
        );
      }
      for (const file of parsed.files) {
        await requireRegularProjectFile(
          workspaceRoot,
          file,
          `test script ${scriptName} target`
        );
      }
      commands.push({ ...parsed, original, scriptName });
    }
  }
  if (commands.length === 0) {
    throw snapshotFailure("package manifest defines no test:* scripts");
  }
  return commands;
}

export function commandKey(command: TestCommand): string {
  return `${command.scriptName}\0${command.original}\0${command.files.join("\0")}`;
}

export function selector(command: TestCommand): string {
  return command.runner === "bun"
    ? `bun test ${command.files.join(" ")}`
    : `node --test ${command.files.join(" ")}`;
}

export function legacyBunSelectors(
  command: TestCommand,
  name: string
): readonly string[] {
  if (command.runner !== "bun") return [];
  const pattern = `^${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`;
  return command.files.map(
    (file) => `bun test --test-name-pattern="${pattern}" ${file}`
  );
}
