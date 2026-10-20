import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as v from "valibot";
import type { GeneratedArtifact } from "./generated-file.ts";
export { syncSourceRuntimeArtifacts } from "./source-runtime-sync.ts";
import { githubRepository, rootDir } from "./project.ts";

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

type ModuleReference = Readonly<{
  specifier: string;
  start: number;
  end: number;
}>;
/** 只在一次生成调用内共享的已读取事实；每次顶层调用重新采集。 */
export type SourceRuntimeFacts = Readonly<{
  workspaceRoot: string;
  references: ReadonlyMap<string, readonly ModuleReference[]>;
  packageManager: string;
  dependencies: Readonly<Record<string, string>>;
}>;
export type SourceRuntimeOptions = Readonly<{
  workspaceRoot?: string;
  skillName: string;
  entries: readonly Readonly<{
    sourcePath: string;
    outputName: string;
    body: string;
  }>[];
  rebuildCommand: string;
  nodeEngine: string;
  additionalDependencies?: Readonly<Record<string, string>>;
  resources?: readonly Readonly<{ sourcePath: string; outputPath: string }>[];
}>;

function runtimeHeader(
  sourcePath: string,
  options: SourceRuntimeOptions
): string {
  return `/*
 * Synced TypeScript runtime; repository maintenance edits ${sourcePath}.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/${githubRepository}
 * Source path: ${sourcePath}
 * Maintained source: https://github.com/${githubRepository}/blob/main/${sourcePath}
 * Skill source directory: https://github.com/${githubRepository}/tree/main/skills/${options.skillName}
 * Rebuild: ${options.rebuildCommand}
 */\n`;
}

async function sourceReferences(
  workspaceRoot: string
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
      "--globs",
      "**/src/**/*.ts",
      "tools"
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

export async function captureSourceRuntimeFacts(
  workspaceRoot: string = rootDir
): Promise<SourceRuntimeFacts> {
  const root = path.resolve(workspaceRoot);
  const references = await sourceReferences(root);
  const manifest = v.parse(
    manifestSchema,
    JSON.parse(
      await fs.readFile(path.join(root, "package.json"), "utf8")
    ) as unknown
  );
  return Object.freeze({
    workspaceRoot: root,
    references,
    packageManager: manifest.packageManager,
    dependencies: Object.freeze(manifest.devDependencies)
  });
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : (parts[0] ?? specifier);
}

type CopiedRuntimeModule = Readonly<{
  artifact: GeneratedArtifact;
  imports: readonly string[];
}>;

async function copyRuntimeModule(
  file: string,
  references: readonly ModuleReference[],
  options: SourceRuntimeOptions,
  rootDependencies: Readonly<Record<string, string>>,
  dependencies: Record<string, string>,
  workspaceRoot: string
): Promise<CopiedRuntimeModule> {
  const sourcePath = path.relative(workspaceRoot, file).replaceAll("\\", "/");
  if (!sourcePath.startsWith("tools/") || !sourcePath.endsWith(".ts")) {
    throw new Error(
      `Runtime source must be TypeScript owned by tools/: ${sourcePath}`
    );
  }
  const status = await fs.lstat(file);
  if (!status.isFile())
    throw new Error(`Runtime source must be a regular file: ${sourcePath}`);
  const imports: string[] = [];
  let bytes = await fs.readFile(file);
  for (const reference of [...references].sort((a, b) => b.start - a.start)) {
    if (reference.specifier.startsWith("node:")) {
      const nodeTypes = rootDependencies["@types/node"];
      if (nodeTypes === undefined)
        throw new Error(
          "Root manifest must declare @types/node for TS consumers"
        );
      dependencies["@types/node"] = nodeTypes;
      continue;
    }
    if (!reference.specifier.startsWith(".")) {
      const name = packageName(reference.specifier);
      const version = dependencies[name] ?? rootDependencies[name];
      if (version === undefined)
        throw new Error(
          `Declare runtime dependency ${name} used by ${sourcePath}`
        );
      dependencies[name] = version;
      const typePackage = `@types/${name.replace(/^@/u, "").replace("/", "__")}`;
      const typeVersion = rootDependencies[typePackage];
      if (typeVersion !== undefined) dependencies[typePackage] = typeVersion;
      continue;
    }
    const specifier = reference.specifier.replace(/\.m?js$/u, ".ts");
    imports.push(path.resolve(path.dirname(file), specifier));
    if (specifier !== reference.specifier) {
      bytes = Buffer.concat([
        bytes.subarray(0, reference.start),
        Buffer.from(JSON.stringify(specifier)),
        bytes.subarray(reference.end)
      ]);
    }
  }
  const original = bytes.toString("utf8");
  const source = original.startsWith("#!")
    ? "//" + original.slice(2)
    : original;
  return {
    imports,
    artifact: {
      path: path.join(
        workspaceRoot,
        "skills",
        options.skillName,
        "scripts/runtime",
        sourcePath
      ),
      content: runtimeHeader(sourcePath, options) + source,
      sourcePath
    }
  };
}

function runtimeManifestArtifact(
  options: SourceRuntimeOptions,
  packageManager: string,
  dependencies: Readonly<Record<string, string>>,
  workspaceRoot: string
): GeneratedArtifact {
  const skillRoot = path.join(workspaceRoot, "skills", options.skillName);
  return {
    path: path.join(skillRoot, "package.json"),
    content:
      JSON.stringify(
        {
          name: `@skills/${options.skillName}`,
          private: true,
          type: "module",
          engines: { node: options.nodeEngine },
          packageManager,
          dependencies: Object.fromEntries(
            Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))
          )
        },
        null,
        2
      ) + "\n"
  };
}

export async function buildSourceRuntimeArtifacts(
  options: SourceRuntimeOptions,
  facts?: SourceRuntimeFacts
): Promise<GeneratedArtifact[]> {
  const workspaceRoot = path.resolve(
    options.workspaceRoot ?? facts?.workspaceRoot ?? rootDir
  );
  const inputs = facts ?? (await captureSourceRuntimeFacts(workspaceRoot));
  if (inputs.workspaceRoot !== workspaceRoot)
    throw new Error("Source runtime facts belong to another workspace");
  const skillRoot = path.join(workspaceRoot, "skills", options.skillName);
  const pending = options.entries.map((entry) =>
    path.join(workspaceRoot, entry.sourcePath)
  );
  const seen = new Set<string>();
  const dependencies: Record<string, string> = {
    ...options.additionalDependencies
  };
  const artifacts: GeneratedArtifact[] = [];
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const result = await copyRuntimeModule(
      file,
      inputs.references.get(file) ?? [],
      options,
      inputs.dependencies,
      dependencies,
      workspaceRoot
    );
    pending.push(...result.imports);
    artifacts.push(result.artifact);
  }
  for (const entry of options.entries) {
    artifacts.push({
      path: path.join(skillRoot, "scripts", entry.outputName),
      sourcePath: entry.sourcePath,
      content: `#!/usr/bin/env node\n${runtimeHeader(entry.sourcePath, options)}${entry.body}\n`
    });
  }
  for (const resource of options.resources ?? []) {
    artifacts.push({
      path: path.join(skillRoot, resource.outputPath),
      sourcePath: resource.sourcePath,
      content: await fs.readFile(
        path.join(workspaceRoot, resource.sourcePath),
        "utf8"
      )
    });
  }
  artifacts.push(
    runtimeManifestArtifact(
      options,
      inputs.packageManager,
      dependencies,
      workspaceRoot
    )
  );
  artifacts.push({
    path: path.join(skillRoot, ".gitignore"),
    content:
      "node_modules/\n.pnpm-store/\n.pnpm/\nnpm-debug.log*\npnpm-debug.log*\n"
  });
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}
