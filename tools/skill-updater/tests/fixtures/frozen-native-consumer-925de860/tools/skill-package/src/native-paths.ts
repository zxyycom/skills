function safeSegment(segment: string): boolean {
  return (
    segment !== "" &&
    segment !== "." &&
    segment !== ".." &&
    !/[\\<>:"|?*]/.test(segment) &&
    !/[. ]$/.test(segment) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment) &&
    !Array.from(segment).some((char) => char.charCodeAt(0) < 32)
  );
}

/** Portable relative paths, unique on the two supported filesystems. */
export function assertNativeRelativePaths(paths: readonly string[]): void {
  const seen = new Set<string>();
  const prefixes = new Map<string, string>();
  for (const name of paths) {
    if (!name.split("/").every(safeSegment))
      throw new Error(`unsafe native path: ${name}`);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`duplicate native path: ${name}`);
    if (prefixes.has(key))
      throw new Error(`native file conflicts with directory: ${name}`);
    seen.add(key);
    checkDirectoryAliases(name, prefixes, seen);
  }
}

function checkDirectoryAliases(
  name: string,
  prefixes: Map<string, string>,
  files: Set<string>
): void {
  const parts = name.split("/");
  for (let index = 1; index < parts.length; index++) {
    const prefix = parts.slice(0, index).join("/");
    const key = prefix.toLowerCase();
    const previous = prefixes.get(key);
    if (files.has(key))
      throw new Error(`native directory conflicts with file: ${prefix}`);
    if (previous !== undefined && previous !== prefix)
      throw new Error(`aliased native directory: ${prefix}`);
    prefixes.set(key, prefix);
  }
}
