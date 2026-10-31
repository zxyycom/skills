import path from "node:path";
import { pathToFileURL } from "node:url";
import { rootDir } from "../project.ts";
import type { SourceRuntimeOptions } from "./runtime/source-runtime.ts";

type NativeCliEntryOptions = Readonly<{
  sourcePath: string;
  outputName: string;
  runner: string;
  declarationName?: string;
  typedExports?: readonly string[];
  invocation?: string;
}>;

async function publicExportLines(
  options: NativeCliEntryOptions
): Promise<readonly string[]> {
  const runtime: unknown = await import(
    pathToFileURL(path.join(rootDir, options.sourcePath)).href
  );
  if (typeof runtime !== "object" || runtime === null)
    throw new Error(`Invalid runtime exports: ${options.sourcePath}`);
  const lines: string[] = [];
  if (options.declarationName === undefined) {
    lines.push(
      `export type * from ${JSON.stringify(`./runtime/${options.sourcePath}`)};`
    );
  } else {
    const declaration = JSON.stringify(`./${options.declarationName}`);
    lines.push(
      `import type * as Public from ${declaration};`,
      `export type * from ${declaration};`,
      "// Bind the same runtime references to the existing public declaration contract.",
      "// Emitted nominal brands/private fields and existing readonly projections do not create new runtime identities.",
      "const publicRuntime = runtime as unknown as typeof Public;"
    );
  }
  for (const [name, value] of Object.entries(runtime).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const typed = options.typedExports?.includes(name) === true;
    if (
      typeof value === "function" &&
      Function.prototype.toString.call(value).startsWith("class ")
    ) {
      const owner = typed
        ? "Public"
        : `import(${JSON.stringify(`./runtime/${options.sourcePath}`)})`;
      lines.push(`export type ${name} = ${owner}.${name};`);
    }
    lines.push(
      `export const ${name}${typed ? `: typeof Public.${name}` : ""} = ${typed ? "publicRuntime" : "runtime"}.${name};`
    );
  }
  return lines;
}

/** No installation or generic loader: each public entry loads its literal closure. */
export async function nativeCliEntry(
  options: NativeCliEntryOptions
): Promise<SourceRuntimeOptions["entries"][number]> {
  const runtimePath = JSON.stringify(`./runtime/${options.sourcePath}`);
  const exports = await publicExportLines(options);
  return {
    sourcePath: options.sourcePath,
    outputName: options.outputName,
    body: `import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let runtime: typeof import(${runtimePath});
try {
  runtime = await import(${runtimePath});
} catch (error) {
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\\nRestore compatible dependencies explicitly:\\n  pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
${exports.join("\n")}
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    ${options.invocation ?? `process.exitCode = await runtime.${options.runner}();`}
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}`
  };
}
