import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedArtifact } from "./generated-file.ts";
export { syncSourceRuntimeArtifacts } from "./source-runtime-sync.ts";
import { githubRepository, rootDir } from "./project.ts";
import {
  assertRuntimeSourceFile,
  captureSourceRuntimeFacts,
  type ModuleReference,
  type SourceRuntimeFacts
} from "./source-runtime-facts.ts";
export { captureSourceRuntimeFacts, type SourceRuntimeFacts };

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
  const sourcePath = await assertRuntimeSourceFile(file, workspaceRoot);
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
  const inputs =
    facts ??
    (await captureSourceRuntimeFacts(
      workspaceRoot,
      options.entries.map((entry) => entry.sourcePath)
    ));
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
    if (inputs.entrySourcePaths !== undefined && !inputs.references.has(file))
      throw new Error(
        `Source runtime facts do not cover ${path.relative(workspaceRoot, file)}`
      );
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
