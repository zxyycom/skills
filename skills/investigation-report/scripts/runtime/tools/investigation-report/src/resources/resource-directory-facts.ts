/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/resources/resource-directory-facts.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/resources/resource-directory-facts.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/resources/resource-directory-facts.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { inspectResource } from "./resource-inspection.ts";
import type { BigIntStats, Dirent } from "node:fs";
import fs from "node:fs/promises";
import { verifiedCanonicalResourceDirectory } from "./resource-canonical-path.ts";

type DirectoryNames = Readonly<{
  names: ReadonlyMap<string, Dirent<string>>;
  folded: ReadonlyMap<string, Dirent<string>>;
}>;
type DirectoryNamespace = Readonly<{
  stat: BigIntStats;
  indexes: DirectoryNames;
}>;
type DirectoryFacts = {
  readonly canonical: string;
  readonly identity: BigIntStats;
  namespace: DirectoryNamespace | null;
  readonly requested: Map<string, string | null>;
};

/** One validation phase owns names, but every lookup rechecks live identity. */
export class ResourceDirectoryFacts {
  readonly #root: string;
  readonly #directories = new Map<string, DirectoryFacts>();

  private constructor(root: string) {
    this.#root = root;
  }

  static async create(root: string): Promise<ResourceDirectoryFacts> {
    const session = new ResourceDirectoryFacts(root);
    await session.#inspect(root);
    return session;
  }

  async entry(
    directory: string,
    segment: string
  ): Promise<Dirent<string> | null> {
    const facts = await this.#inspect(directory);
    const names = await this.#refreshNames(directory, facts);
    const entry = matchedEntry(names, segment);
    facts.requested.set(segment, entryName(entry));
    return entry;
  }

  async directory(directory: string): Promise<string> {
    return (await this.#inspect(directory)).canonical;
  }

  async assertCurrent(): Promise<void> {
    for (const [directory, facts] of this.#directories) {
      await this.#inspect(directory);
      if (facts.namespace !== null) await this.#refreshNames(directory, facts);
    }
  }

  async #inspect(directory: string): Promise<DirectoryFacts> {
    const prior = this.#directories.get(directory);
    if (prior !== undefined) {
      const before = await inspectResource(
        "inspect resource directory",
        directory,
        () => fs.lstat(directory, { bigint: true })
      );
      assertDirectoryIdentity(before, prior.identity);
      const canonical = await inspectResource(
        "resolve resource directory",
        directory,
        () => fs.realpath(directory)
      );
      const after = await inspectResource(
        "inspect resource directory",
        directory,
        () => fs.lstat(directory, { bigint: true })
      );
      assertDirectoryIdentity(after, before);
      if (canonical !== prior.canonical)
        throw new Error(
          "resource directory canonical identity changed during validation"
        );
      return prior;
    }
    const canonical = await verifiedCanonicalResourceDirectory(
      directory,
      this.#root
    );
    const stat = await inspectResource(
      "inspect resource directory",
      directory,
      () => fs.lstat(directory, { bigint: true })
    );
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error("resource directory type changed during validation");
    const facts: DirectoryFacts = {
      canonical,
      identity: stat,
      namespace: null,
      requested: new Map()
    };
    this.#directories.set(directory, facts);
    return facts;
  }

  async #refreshNames(
    directory: string,
    facts: DirectoryFacts
  ): Promise<DirectoryNames> {
    const before = await inspectResource(
      "inspect resource directory",
      directory,
      () => fs.lstat(directory, { bigint: true })
    );
    const prior = facts.namespace;
    if (prior !== null && sameNamespace(prior.stat, before))
      return prior.indexes;
    const observed = await this.#readStableNames(directory, before);
    const names = nameIndexes(observed.entries);
    assertRelatedNames(facts.requested, names);
    facts.namespace = { stat: observed.stat, indexes: names };
    return names;
  }
  async #readStableNames(
    directory: string,
    before: BigIntStats
  ): Promise<Readonly<{ entries: Dirent<string>[]; stat: BigIntStats }>> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const entries = await inspectResource(
        "read resource directory",
        directory,
        () => fs.readdir(directory, { withFileTypes: true })
      );
      await this.#inspect(directory);
      const after = await inspectResource(
        "inspect resource directory",
        directory,
        () => fs.lstat(directory, { bigint: true })
      );
      if (sameNamespace(before, after)) return { entries, stat: after };
      before = after;
    }
    throw new Error(
      "resource directory names could not be observed consistently"
    );
  }
}

function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}
function sameNamespace(left: BigIntStats, right: BigIntStats): boolean {
  return (
    sameIdentity(left, right) &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.mode === right.mode &&
    left.nlink === right.nlink
  );
}

function assertDirectoryIdentity(
  current: BigIntStats,
  expected: BigIntStats
): void {
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    !sameIdentity(current, expected)
  )
    throw new Error(
      "resource directory identity or type changed during validation"
    );
}
function nameIndexes(entries: readonly Dirent<string>[]): DirectoryNames {
  const names = new Map<string, Dirent<string>>();
  const folded = new Map<string, Dirent<string>>();
  for (const entry of entries) {
    names.set(entry.name, entry);
    const key = entry.name.toLowerCase();
    if (!folded.has(key)) folded.set(key, entry);
  }
  return { names, folded };
}
function matchedEntry(
  indexes: DirectoryNames,
  segment: string
): Dirent<string> | null {
  const exact = indexes.names.get(segment);
  if (exact !== undefined) return exact;
  return indexes.folded.get(segment.toLowerCase()) ?? null;
}
function entryName(entry: Dirent<string> | null): string | null {
  return entry === null ? null : entry.name;
}
function assertRelatedNames(
  requested: ReadonlyMap<string, string | null>,
  names: DirectoryNames
): void {
  for (const [segment, expected] of requested)
    if (entryName(matchedEntry(names, segment)) !== expected)
      throw new Error("a related resource path name changed during validation");
}
