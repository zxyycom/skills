import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import * as v from "valibot";

const runtimeDependencies = ["fflate", "valibot", "yaml"] as const;
const allowedDependencies = new Set([...runtimeDependencies, "@types/node"]);
const manifestSchema = v.object({
  dependencies: v.optional(v.record(v.string(), v.string())),
  devDependencies: v.optional(v.record(v.string(), v.string()))
});
const lockSchema = v.object({
  importers: v.object({
    ".": v.object({
      dependencies: v.record(
        v.string(),
        v.object({ specifier: v.string(), version: v.string() })
      )
    })
  })
});

async function currentManifest(): Promise<Record<string, string>> {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    try {
      const value: unknown = JSON.parse(
        await fs.readFile(path.join(directory, "package.json"), "utf8")
      );
      const parsed = v.parse(manifestSchema, value);
      return parsed.dependencies ?? parsed.devDependencies ?? {};
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error("current updater dependency manifest is unavailable");
    directory = parent;
  }
}

async function resolvedVersion(name: string): Promise<string> {
  const resolved = import.meta.resolve(name);
  let directory = path.dirname(await fs.realpath(fileURLToPath(resolved)));
  while (true) {
    try {
      const value: unknown = JSON.parse(
        await fs.readFile(path.join(directory, "package.json"), "utf8")
      );
      const parsed = v.safeParse(
        v.object({ name: v.string(), version: v.string() }),
        value
      );
      if (parsed.success && parsed.output.name === name)
        return parsed.output.version;
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error(`cannot verify current dependency: ${name}`);
    directory = parent;
  }
}

/** Validate explicitly installed updater dependencies before a temporary child-only fallback. */
export async function compatibleUpdaterDependencies(
  target: string
): Promise<void> {
  const value: unknown = JSON.parse(
    await fs.readFile(path.join(target, "package.json"), "utf8")
  );
  const targetDependencies = v.parse(manifestSchema, value).dependencies;
  if (
    !targetDependencies ||
    Object.keys(targetDependencies).some(
      (name) => !allowedDependencies.has(name)
    )
  ) {
    throw new Error("prepared updater has unsupported dependencies");
  }
  const current = await currentManifest();
  const rawLock: unknown = parseYaml(
    await fs.readFile(path.join(target, "pnpm-lock.yaml"), "utf8")
  );
  const locked = v.parse(lockSchema, rawLock).importers["."].dependencies;
  for (const [name, specifier] of Object.entries(targetDependencies)) {
    if (current[name] !== specifier || locked[name]?.specifier !== specifier) {
      throw new Error(`prepared updater dependency manifest differs: ${name}`);
    }
  }
  await verifyRuntimeVersions(targetDependencies, locked);
}

async function verifyRuntimeVersions(
  targetDependencies: Record<string, string>,
  locked: Record<string, { specifier: string; version: string }>
): Promise<void> {
  for (const name of runtimeDependencies) {
    const record = locked[name];
    if (
      !targetDependencies[name] ||
      !record ||
      (await resolvedVersion(name)) !== record.version.split("(")[0]
    )
      throw new Error(`prepared updater dependency version differs: ${name}`);
  }
}

/** Code for one validation subprocess; no hook is installed in this process or persisted. */
export function updaterDependencyHook(): string {
  const parent = import.meta.url;
  const names = JSON.stringify(runtimeDependencies);
  const source = `import { registerHooks } from "node:module"; const allowed = ${names}; const parent = ${JSON.stringify(parent)}; registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) { if (error?.code !== "ERR_MODULE_NOT_FOUND" || !allowed.some(name => specifier === name || specifier.startsWith(name + "/"))) throw error; return next(specifier, { ...context, parentURL: parent }); } } });`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}
