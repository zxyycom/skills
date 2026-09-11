import fs from "node:fs/promises";
import path from "node:path";
import type { AstGrepMatch } from "./snapshot-types.ts";
import {
  isWithin,
  posixRelative,
  runSnapshotCommand,
  snapshotFailure
} from "./snapshot-files.ts";

const astGrepFileArgumentByteBudget = 20_000;

function importSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  const expression =
    /(?:import\s+(?:[^"']+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/gu;
  for (const match of source.matchAll(expression)) {
    const specifier = match[1];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

function resolveRelativeImport(
  sourcePath: string,
  specifier: string
): readonly string[] {
  if (!specifier.startsWith(".")) return [];
  const base = path.resolve(path.dirname(sourcePath), specifier);
  if (path.extname(base) !== "") return [base];
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.js")
  ];
}

async function existingRegularFile(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.lstat(filePath);
    return stat.isFile() && !stat.isSymbolicLink() ? filePath : null;
  } catch {
    return null;
  }
}

export async function moduleClosure(
  workspaceRoot: string,
  entryFiles: readonly string[]
): Promise<readonly string[]> {
  const pending = [...entryFiles];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (candidate === undefined || seen.has(candidate)) continue;
    if (!isWithin(workspaceRoot, candidate)) {
      throw snapshotFailure(`test import escapes the workspace: ${candidate}`);
    }
    const filePath = await existingRegularFile(candidate);
    if (filePath === null) {
      throw snapshotFailure(
        `test import is not a regular file: ${posixRelative(workspaceRoot, candidate)}`
      );
    }
    seen.add(filePath);
    const source = await fs.readFile(filePath, "utf8");
    for (const specifier of importSpecifiers(source)) {
      for (const resolved of resolveRelativeImport(filePath, specifier)) {
        const existing = await existingRegularFile(resolved);
        if (existing !== null) {
          pending.push(existing);
          break;
        }
      }
    }
  }
  return [...seen].sort();
}

function astGrepFileBatches(
  workspaceRoot: string,
  filePaths: readonly string[]
): readonly (readonly string[])[] {
  const relativePaths = [
    ...new Set(
      filePaths.map((filePath) => posixRelative(workspaceRoot, filePath))
    )
  ].sort();
  const batches: string[][] = [];
  let batch: string[] = [];
  let argumentBytes = 0;
  for (const relativePath of relativePaths) {
    const nextBytes = Buffer.byteLength(relativePath) + 1;
    if (
      batch.length > 0 &&
      argumentBytes + nextBytes > astGrepFileArgumentByteBudget
    ) {
      batches.push(batch);
      batch = [];
      argumentBytes = 0;
    }
    batch.push(relativePath);
    argumentBytes += nextBytes;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

function parseAstGrepMatches(
  value: unknown,
  workspaceRoot: string,
  expectedSourcePaths: ReadonlySet<string>
): readonly AstGrepMatch[] {
  if (!Array.isArray(value)) {
    throw snapshotFailure("ast-grep result is not an array");
  }
  return value.map((candidate) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      throw snapshotFailure("ast-grep result contains a non-object match");
    }
    const match = candidate as Record<string, unknown>;
    const file = match.file;
    if (typeof file !== "string" || file.length === 0 || file.includes("\0")) {
      throw snapshotFailure("ast-grep match does not identify a source file");
    }
    const resolvedFile = path.resolve(workspaceRoot, file);
    const sourcePath = posixRelative(workspaceRoot, resolvedFile);
    if (!expectedSourcePaths.has(sourcePath)) {
      throw snapshotFailure(
        `ast-grep returned an unexpected source file: ${file}`
      );
    }
    const variables: Record<string, string> = {};
    const metaVariables = match.metaVariables;
    if (metaVariables === undefined) return { sourcePath, variables };
    if (
      typeof metaVariables !== "object" ||
      metaVariables === null ||
      Array.isArray(metaVariables)
    ) {
      throw snapshotFailure(
        `ast-grep match has invalid meta variables: ${sourcePath}`
      );
    }
    const single = (metaVariables as Record<string, unknown>).single;
    if (single === undefined) return { sourcePath, variables };
    if (
      typeof single !== "object" ||
      single === null ||
      Array.isArray(single)
    ) {
      throw snapshotFailure(
        `ast-grep match has invalid single variables: ${sourcePath}`
      );
    }
    for (const [name, rawVariable] of Object.entries(single)) {
      if (
        typeof rawVariable !== "object" ||
        rawVariable === null ||
        Array.isArray(rawVariable) ||
        typeof (rawVariable as Record<string, unknown>).text !== "string"
      ) {
        throw snapshotFailure(
          `ast-grep match has an invalid ${name} variable: ${sourcePath}`
        );
      }
      variables[name] = (rawVariable as { text: string }).text;
    }
    return { sourcePath, variables };
  });
}

export async function astGrepJson(
  executable: string,
  workspaceRoot: string,
  pattern: string,
  filePaths: readonly string[]
): Promise<readonly AstGrepMatch[]> {
  const expectedSourcePaths = new Set(
    filePaths.map((filePath) => posixRelative(workspaceRoot, filePath))
  );
  const matches: AstGrepMatch[] = [];
  const batches = astGrepFileBatches(workspaceRoot, filePaths);
  if (batches.length === 0) {
    throw snapshotFailure("ast-grep batch requires at least one source file");
  }
  for (const batch of batches) {
    const result = await runSnapshotCommand(
      executable,
      ["run", "--pattern", pattern, "--lang", "ts", ...batch, "--json=compact"],
      workspaceRoot
    );
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw snapshotFailure(
        `ast-grep failed for a ${batch.length}-file batch: ${result.output.trim()}`
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.output);
    } catch (error) {
      throw snapshotFailure(
        `ast-grep returned invalid JSON for a ${batch.length}-file batch: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    matches.push(
      ...parseAstGrepMatches(parsed, workspaceRoot, expectedSourcePaths)
    );
  }
  return matches;
}
