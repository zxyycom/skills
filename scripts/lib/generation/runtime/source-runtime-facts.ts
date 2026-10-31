import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as v from "valibot";
import { rootDir } from "../../project.ts";

const execFileAsync = promisify(execFile);
const importMatchSchema = v.array(
  v.object({
    file: v.string(),
    text: v.string(),
    range: v.object({
      byteOffset: v.object({ start: v.number(), end: v.number() })
    })
  })
);
const manifestSchema = v.object({
  packageManager: v.string(),
  devDependencies: v.record(v.string(), v.string())
});
const importRule = `id: module-source
language: TypeScript
rule:
  kind: string
  any:
    - inside:
        kind: import_statement
    - inside:
        kind: export_statement
    - inside:
        kind: arguments
        inside:
          pattern: import($$$)
`;

export type ModuleReference = Readonly<{
  specifier: string;
  start: number;
  end: number;
}>;
/** 只在一次生成调用内共享的已读取事实；每次顶层调用重新采集。 */
export type SourceRuntimeFacts = Readonly<{
  workspaceRoot: string;
  references: ReadonlyMap<string, readonly ModuleReference[]>;
  entrySourcePaths?: readonly string[];
  packageManager: string;
  dependencies: Readonly<Record<string, string>>;
}>;
async function sourceReferences(
  workspaceRoot: string,
  sourcePaths?: readonly string[]
): Promise<ReadonlyMap<string, readonly ModuleReference[]>> {
  const { stdout } = await execFileAsync(
    path.join(
      rootDir,
      "node_modules/@ast-grep/cli",
      process.platform === "win32" ? "ast-grep.exe" : "ast-grep"
    ),
    [
      "scan",
      "--inline-rules",
      importRule,
      "--json=compact",
      ...(sourcePaths ?? ["--globs", "**/src/**/*.ts", "tools"])
    ],
    { cwd: workspaceRoot, maxBuffer: 32 * 1024 * 1024 }
  );
  const raw: unknown = JSON.parse(stdout);
  const matches = v.parse(importMatchSchema, raw);
  const byFile = new Map<string, ModuleReference[]>();
  for (const match of matches) {
    // Import specifiers with escapes are deliberately rejected rather than guessed.
    if (!/^["'][^"'\\\r\n]+["']$/u.test(match.text)) {
      throw new Error(
        `Unsupported escaped module specifier in ${match.file}: ${match.text}`
      );
    }
    const file = path.resolve(workspaceRoot, match.file);
    const references = byFile.get(file) ?? [];
    references.push({
      specifier: match.text.slice(1, -1),
      ...match.range.byteOffset
    });
    byFile.set(file, references);
  }
  return byFile;
}

export async function assertRuntimeSourceFile(
  file: string,
  workspaceRoot: string
): Promise<string> {
  const sourcePath = path.relative(workspaceRoot, file).replaceAll("\\", "/");
  if (!sourcePath.startsWith("tools/") || !sourcePath.endsWith(".ts"))
    throw new Error(
      `Runtime source must be TypeScript owned by tools/: ${sourcePath}`
    );
  const trustedToolsRoot = path.join(await fs.realpath(workspaceRoot), "tools");
  const realFile = await fs.realpath(file);
  const realSourcePath = path.relative(trustedToolsRoot, realFile);
  if (
    realSourcePath === ".." ||
    realSourcePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(realSourcePath)
  )
    throw new Error(`Runtime source escapes trusted tools/: ${sourcePath}`);
  if (!(await fs.lstat(file)).isFile())
    throw new Error(`Runtime source must be a regular file: ${sourcePath}`);
  return sourcePath;
}

async function reachableSourceReferences(
  workspaceRoot: string,
  entrySourcePaths: readonly string[]
): Promise<ReadonlyMap<string, readonly ModuleReference[]>> {
  const references = new Map<string, readonly ModuleReference[]>();
  let pending = entrySourcePaths.map((file) =>
    path.resolve(workspaceRoot, file)
  );
  while (pending.length > 0) {
    const files = [...new Set(pending)].filter((file) => !references.has(file));
    if (files.length === 0) break;
    for (const file of files)
      await assertRuntimeSourceFile(file, workspaceRoot);
    const batch = await sourceReferences(workspaceRoot, files);
    pending = [];
    for (const file of files) {
      const imports = batch.get(file) ?? [];
      references.set(file, imports);
      for (const reference of imports) {
        if (reference.specifier.startsWith("."))
          pending.push(
            path.resolve(
              path.dirname(file),
              reference.specifier.replace(/\.m?js$/u, ".ts")
            )
          );
      }
    }
  }
  return references;
}

export async function captureSourceRuntimeFacts(
  workspaceRoot: string = rootDir,
  entrySourcePaths?: readonly string[]
): Promise<SourceRuntimeFacts> {
  const root = path.resolve(workspaceRoot);
  const references =
    entrySourcePaths === undefined
      ? await sourceReferences(root)
      : await reachableSourceReferences(root, entrySourcePaths);
  const manifest = v.parse(
    manifestSchema,
    JSON.parse(
      await fs.readFile(path.join(root, "package.json"), "utf8")
    ) as unknown
  );
  return Object.freeze({
    workspaceRoot: root,
    references,
    ...(entrySourcePaths === undefined
      ? {}
      : { entrySourcePaths: Object.freeze([...entrySourcePaths]) }),
    packageManager: manifest.packageManager,
    dependencies: Object.freeze(manifest.devDependencies)
  });
}
