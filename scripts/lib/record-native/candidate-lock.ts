import { parse, stringify } from "yaml";

/** Keep only the frozen updater importer's reachable registry packages. */
export function candidateLock(manifest: Buffer, lock: Buffer): Buffer {
  const dependencies: Record<string, string> = JSON.parse(
    manifest.toString("utf8")
  ).dependencies;
  const data = parse(lock.toString("utf8"));
  const old = data?.importers?.["."]?.dependencies;
  if (!old || !data.packages || !data.snapshots)
    throw new Error("frozen skill lock is missing dependency records");
  const selected: Record<string, unknown> = {};
  const pending: string[] = [];
  const add = (name: string, version: unknown) => {
    if (
      typeof version !== "string" ||
      !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)
    )
      throw new Error(`unsupported frozen dependency: ${name}`);
    pending.push(`${name}@${version}`);
  };
  for (const [name, specifier] of Object.entries(dependencies)) {
    if (!old[name] || old[name].specifier !== specifier)
      throw new Error(
        `frozen skill lock does not match generated dependency ${name}`
      );
    selected[name] = old[name];
    add(name, old[name].version);
  }
  const packages: Record<string, unknown> = {};
  const snapshots: Record<string, unknown> = {};
  while (pending.length) {
    const key = pending.pop()!;
    if (key in snapshots) continue;
    const entry = data.snapshots[key];
    if (!entry || !data.packages[key])
      throw new Error(`frozen dependency record missing: ${key}`);
    packages[key] = data.packages[key];
    snapshots[key] = entry;
    for (const group of [entry.dependencies, entry.optionalDependencies])
      for (const [name, version] of Object.entries(group ?? {}))
        add(name, version);
  }
  data.importers = { ".": { dependencies: selected } };
  data.packages = packages;
  data.snapshots = snapshots;
  return Buffer.from(stringify(data));
}
