import path from "node:path";
import type { AstGrepMatch, TestCommand } from "./snapshot-types.ts";
import type { SnapshotModuleScan } from "./snapshot-ast-scan.ts";
import { commandKey } from "./snapshot-commands.ts";
import { astGrepPatternsJson } from "./snapshot-ast-scan.ts";
import {
  posixRelative,
  resolveAstGrep,
  snapshotFailure
} from "./snapshot-files.ts";

const unsupportedPatterns = [
  "t.test($$$)",
  "it($$$)",
  "suite($$$)",
  "test($$$, () => { $$$ test($$$) $$$ })",
  "test($$$, async () => { $$$ test($$$) $$$ })"
];
const staticPattern = "test($NAME, $$$)";
const parameterizedPattern =
  "for (const $VALUE of $VALUES) { $$$ test($NAME, $$$) $$$ }";

export async function assertSupportedRegistrationShape(
  workspaceRoot: string,
  commands: readonly TestCommand[],
  modules: SnapshotModuleScan
): Promise<ReadonlyMap<string, readonly AstGrepMatch[]>> {
  const executable = await resolveAstGrep(workspaceRoot);
  const entries = commands.flatMap(({ files }) =>
    files.map((file) => path.resolve(workspaceRoot, file))
  );
  const closure = await modules.closure([...new Set(entries)]);
  const matches = await astGrepPatternsJson(
    executable,
    workspaceRoot,
    [...unsupportedPatterns, staticPattern, parameterizedPattern],
    closure,
    modules
  );
  for (const pattern of unsupportedPatterns) {
    const firstMatch = matches.get(pattern)?.[0];
    if (firstMatch !== undefined) {
      throw snapshotFailure(
        `unsupported registration shape ${pattern} in ${firstMatch.sourcePath}`
      );
    }
  }
  for (const filePath of closure) {
    const source = await modules.source(filePath);
    if (
      /from\s*["'](?:node|bun):test["']/u.test(source) &&
      /\b(?:test|describe)\s+as\s+/u.test(source)
    ) {
      throw snapshotFailure(
        `unsupported aliased test API import in ${posixRelative(workspaceRoot, filePath)}`
      );
    }
  }
  return matches;
}

export async function registrationClosures(
  workspaceRoot: string,
  commands: readonly TestCommand[],
  modules: SnapshotModuleScan
): Promise<ReadonlyMap<string, readonly string[]>> {
  const byCommand = new Map<string, readonly string[]>();
  for (const command of commands) {
    byCommand.set(
      commandKey(command),
      await modules.closure(
        command.files.map((file) => path.resolve(workspaceRoot, file))
      )
    );
  }
  return byCommand;
}

function testNameFromAstMatch(match: AstGrepMatch): string | null {
  const literal = match.variables.NAME;
  if (literal === undefined || !literal.startsWith('"')) return null;
  try {
    const name: unknown = JSON.parse(literal);
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

function parameterizedTestNames(match: AstGrepMatch): readonly string[] {
  const variable = match.variables.VALUE;
  const values = match.variables.VALUES;
  const template = match.variables.NAME;
  if (
    typeof variable !== "string" ||
    typeof values !== "string" ||
    typeof template !== "string" ||
    !/^[$A-Z_a-z][$\w]*$/u.test(variable) ||
    template.length < 2 ||
    !template.startsWith("`") ||
    !template.endsWith("`")
  ) {
    return [];
  }
  let matrix: unknown;
  try {
    matrix = JSON.parse(values);
  } catch {
    return [];
  }
  if (
    !Array.isArray(matrix) ||
    !matrix.every(
      (value) =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    )
  ) {
    return [];
  }
  const body = template.slice(1, -1);
  const marker = `\${${variable}}`;
  if (body.includes("\\") || body.split(marker).length !== 2) return [];
  return matrix.map((value) => body.replace(marker, String(value)));
}

export async function registrationDefinitions(
  workspaceRoot: string,
  closures: ReadonlyMap<string, readonly string[]>,
  matches: ReadonlyMap<string, readonly AstGrepMatch[]>
): Promise<ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>> {
  const definitionsByName = new Map<string, Set<string>>();
  const addDefinitions = (
    sourcePath: string,
    names: readonly string[]
  ): void => {
    for (const name of names) {
      const paths = definitionsByName.get(name) ?? new Set<string>();
      paths.add(sourcePath);
      definitionsByName.set(name, paths);
    }
  };
  const staticMatches = matches.get(staticPattern) ?? [];
  for (const match of staticMatches) {
    const name = testNameFromAstMatch(match);
    if (name !== null) addDefinitions(match.sourcePath, [name]);
  }
  const parameterizedMatches = matches.get(parameterizedPattern) ?? [];
  for (const match of parameterizedMatches) {
    addDefinitions(match.sourcePath, parameterizedTestNames(match));
  }
  const scoped = new Map<string, ReadonlyMap<string, readonly string[]>>();
  for (const [key, closure] of closures) {
    const allowed = new Set(
      closure.map((file) => posixRelative(workspaceRoot, file))
    );
    const byName = new Map<string, readonly string[]>();
    for (const [name, candidates] of definitionsByName) {
      const paths = [...candidates].filter((candidate) =>
        allowed.has(candidate)
      );
      if (paths.length > 0) byName.set(name, paths);
    }
    scoped.set(key, byName);
  }
  return scoped;
}
