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

type ModuleFacts = Readonly<{
  source: string;
  imports: readonly string[];
}>;

// 读取事实只属于本次快照；起止 source fingerprint 始终独立读取。
export class SnapshotModuleScan {
  private readonly workspaceRoot: string;
  private readonly regularFiles = new Map<string, string | null>();
  private readonly modules = new Map<string, ModuleFacts>();

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  private async regularFile(filePath: string): Promise<string | null> {
    const known = this.regularFiles.get(filePath);
    if (known !== undefined) return known;
    const existing = await existingRegularFile(filePath);
    this.regularFiles.set(filePath, existing);
    return existing;
  }

  private async moduleFacts(filePath: string): Promise<ModuleFacts> {
    const known = this.modules.get(filePath);
    if (known !== undefined) return known;
    const source = await fs.readFile(filePath, "utf8");
    const imports: string[] = [];
    for (const specifier of importSpecifiers(source)) {
      for (const resolved of resolveRelativeImport(filePath, specifier)) {
        const existing = await this.regularFile(resolved);
        if (existing !== null) {
          imports.push(existing);
          break;
        }
      }
    }
    const facts = { source, imports };
    this.modules.set(filePath, facts);
    return facts;
  }

  async source(filePath: string): Promise<string> {
    return (await this.moduleFacts(filePath)).source;
  }

  async closure(entryFiles: readonly string[]): Promise<readonly string[]> {
    const pending = [...entryFiles];
    const seen = new Set<string>();
    while (pending.length > 0) {
      const candidate = pending.pop();
      if (candidate === undefined || seen.has(candidate)) continue;
      if (!isWithin(this.workspaceRoot, candidate)) {
        throw snapshotFailure(
          `test import escapes the workspace: ${candidate}`
        );
      }
      const filePath = await this.regularFile(candidate);
      if (filePath === null) {
        throw snapshotFailure(
          `test import is not a regular file: ${posixRelative(this.workspaceRoot, candidate)}`
        );
      }
      seen.add(filePath);
      pending.push(...(await this.moduleFacts(filePath)).imports);
    }
    return [...seen].sort();
  }
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
    if (!isRecord(candidate)) {
      throw snapshotFailure("ast-grep result contains a non-object match");
    }
    const file = candidate.file;
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
    const variables = parseAstGrepVariables(
      candidate.metaVariables,
      sourcePath
    );
    return { sourcePath, variables };
  });
}

function parseAstGrepVariables(
  metaVariables: unknown,
  sourcePath: string
): Record<string, string> {
  const variables: Record<string, string> = {};
  if (metaVariables === undefined) return variables;
  if (!isRecord(metaVariables)) {
    throw snapshotFailure(
      `ast-grep match has invalid meta variables: ${sourcePath}`
    );
  }
  const single = metaVariables.single;
  if (single === undefined) return variables;
  if (!isRecord(single)) {
    throw snapshotFailure(
      `ast-grep match has invalid single variables: ${sourcePath}`
    );
  }
  for (const [name, rawVariable] of Object.entries(single)) {
    if (!isRecord(rawVariable) || typeof rawVariable.text !== "string") {
      throw snapshotFailure(
        `ast-grep match has an invalid ${name} variable: ${sourcePath}`
      );
    }
    variables[name] = rawVariable.text;
  }
  return variables;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAstGrepOutput(output: string, fileCount: number): unknown {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw snapshotFailure(
      `ast-grep returned invalid JSON for a ${fileCount}-file batch: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function appendRuleMatches(
  value: unknown,
  workspaceRoot: string,
  expectedSourcePaths: ReadonlySet<string>,
  byRule: ReadonlyMap<string, AstGrepMatch[]>
): void {
  const matches = parseAstGrepMatches(
    value,
    workspaceRoot,
    expectedSourcePaths
  );
  if (!Array.isArray(value))
    throw snapshotFailure("ast-grep result is not an array");
  for (const [index, candidate] of value.entries()) {
    const target =
      isRecord(candidate) && typeof candidate.ruleId === "string"
        ? byRule.get(candidate.ruleId)
        : undefined;
    const match = matches[index];
    if (target === undefined || match === undefined) {
      throw snapshotFailure("ast-grep scan match has an unexpected rule ID");
    }
    target.push(match);
  }
}

export async function astGrepPatternsJson(
  executable: string,
  workspaceRoot: string,
  patterns: readonly string[],
  filePaths: readonly string[],
  modules: SnapshotModuleScan
): Promise<ReadonlyMap<string, readonly AstGrepMatch[]>> {
  const combined: string[] = [];
  const compatible: string[] = [];
  for (const filePath of filePaths) {
    // scan 会处理 suppression；这些文件与其他后缀继续使用原 run 契约。
    const source = await modules.source(filePath);
    (filePath.endsWith(".ts") && !source.includes("ast-grep-ignore")
      ? combined
      : compatible
    ).push(filePath);
  }
  const byPattern = new Map(
    patterns.map((pattern) => [pattern, [] as AstGrepMatch[]])
  );
  const byRule = new Map(
    patterns.map((pattern, index) => [
      `registration-${index}`,
      byPattern.get(pattern) ?? []
    ])
  );
  const rules = patterns
    .map((pattern, index) =>
      [
        `id: registration-${index}`,
        "language: TypeScript",
        "severity: info",
        "rule:",
        `  pattern: ${JSON.stringify(pattern)}`
      ].join("\n")
    )
    .join("\n---\n");
  for (const batch of astGrepFileBatches(workspaceRoot, combined)) {
    const result = await runSnapshotCommand(
      executable,
      ["scan", "--inline-rules", rules, ...batch, "--json=compact"],
      workspaceRoot
    );
    // info 规则命中也应为 0；任何非零状态都是扫描失败。
    if (result.exitCode !== 0) {
      throw snapshotFailure(
        `ast-grep scan failed for a ${batch.length}-file batch: ${result.output.trim()}`
      );
    }
    appendRuleMatches(
      parseAstGrepOutput(result.output, batch.length),
      workspaceRoot,
      new Set(batch),
      byRule
    );
  }
  if (compatible.length > 0) {
    for (const pattern of patterns) {
      byPattern
        .get(pattern)
        ?.push(
          ...(await astGrepJson(executable, workspaceRoot, pattern, compatible))
        );
    }
  }
  return byPattern;
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
    matches.push(
      ...parseAstGrepMatches(
        parseAstGrepOutput(result.output, batch.length),
        workspaceRoot,
        expectedSourcePaths
      )
    );
  }
  return matches;
}
