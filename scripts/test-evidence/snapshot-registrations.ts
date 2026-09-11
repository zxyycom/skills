import fs from "node:fs/promises";
import path from "node:path";
import type { AstGrepMatch, TestCommand } from "./snapshot-types.ts";
import { commandKey } from "./snapshot-commands.ts";
import { astGrepJson, moduleClosure } from "./snapshot-ast-scan.ts";
import {
  posixRelative,
  resolveAstGrep,
  snapshotFailure
} from "./snapshot-files.ts";

export async function assertSupportedRegistrationShape(
  workspaceRoot: string,
  commands: readonly TestCommand[]
): Promise<void> {
  const executable = await resolveAstGrep(workspaceRoot);
  const entries = commands.flatMap(({ files }) =>
    files.map((file) => path.resolve(workspaceRoot, file))
  );
  const closure = await moduleClosure(workspaceRoot, [...new Set(entries)]);
  for (const pattern of [
    "t.test($$$)",
    "it($$$)",
    "suite($$$)",
    "test($$$, () => { $$$ test($$$) $$$ })",
    "test($$$, async () => { $$$ test($$$) $$$ })"
  ]) {
    const firstMatch = (
      await astGrepJson(executable, workspaceRoot, pattern, closure)
    )[0];
    if (firstMatch !== undefined) {
      throw snapshotFailure(
        `unsupported registration shape ${pattern} in ${firstMatch.sourcePath}`
      );
    }
  }
  for (const filePath of closure) {
    const source = await fs.readFile(filePath, "utf8");
    if (
      /from\s*["'](?:node|bun):test["']/u.test(source) &&
      /\b(?:test|describe)\s+as\s+/u.test(source)
    ) {
      throw snapshotFailure(
        `unsupported aliased test API import in ${posixRelative(workspaceRoot, filePath)}`
      );
    }
  }
}

export async function registrationClosures(
  workspaceRoot: string,
  commands: readonly TestCommand[]
): Promise<ReadonlyMap<string, readonly string[]>> {
  const byCommand = new Map<string, readonly string[]>();
  for (const command of commands) {
    byCommand.set(
      commandKey(command),
      await moduleClosure(
        workspaceRoot,
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
  closures: ReadonlyMap<string, readonly string[]>
): Promise<ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>> {
  const executable = await resolveAstGrep(workspaceRoot);
  const files = new Set<string>();
  for (const closure of closures.values()) {
    for (const file of closure) files.add(file);
  }
  const definitionsByName = new Map<string, Set<string>>();
  const filePaths = [...files].sort();
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
  const staticMatches = await astGrepJson(
    executable,
    workspaceRoot,
    "test($NAME, $$$)",
    filePaths
  );
  for (const match of staticMatches) {
    const name = testNameFromAstMatch(match);
    if (name !== null) addDefinitions(match.sourcePath, [name]);
  }
  const parameterizedMatches = await astGrepJson(
    executable,
    workspaceRoot,
    "for (const $VALUE of $VALUES) { $$$ test($NAME, $$$) $$$ }",
    filePaths
  );
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
