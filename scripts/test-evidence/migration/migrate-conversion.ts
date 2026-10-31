import path from "node:path";
import type { LegacyCase } from "./legacy.ts";
import { legacyRoot, sha256 } from "./legacy.ts";
import type {
  ConvertedCase,
  MigrationIndex,
  SnapshotEntity
} from "./migrate-types.ts";
import { MigrationError } from "./migrate-types.ts";
import {
  compare,
  exists,
  isProjectRelativePath,
  isSorted,
  messageOf,
  uniqueSorted
} from "./migrate-values.ts";

export function convertLegacyCase(
  legacyCase: LegacyCase,
  entities: ReadonlyMap<string, readonly SnapshotEntity[]>
): { errors: readonly string[]; value?: ConvertedCase } {
  const entityIds = new Set<string>();
  const errors: string[] = [];
  for (const entry of legacyCase.entries) {
    try {
      const matches = new Map<string, SnapshotEntity>();
      for (const locator of legacyEntryLocators(entry)) {
        for (const entity of entities.get(locator) ?? []) {
          matches.set(entity.id, entity);
        }
      }
      if (matches.size !== 1) {
        throw new MigrationError("cannot map to exactly one snapshot entity");
      }
      entityIds.add(matches.values().next().value!.id);
    } catch (error) {
      errors.push(`${legacyCase.id} Entry ${messageOf(error)}: ${entry}`);
    }
  }
  if (errors.length > 0) return { errors };
  const testIds = [...entityIds].sort(compare);
  const tags = [legacyCase.topicId];
  const text = [
    `### Case ${legacyCase.id}: ${legacyCase.title}`,
    "",
    "Tests:",
    ...testIds.map((id) => `- \`${id}\``),
    "",
    "Tags:",
    ...tags.map((tag) => `- \`${tag}\``),
    "",
    "Contract:",
    ...legacyCase.contract.map((item) => `- ${item}`),
    "",
    "Proves:",
    ...legacyCase.proves.map((item) => `- ${item}`),
    ""
  ].join("\n");
  return {
    errors,
    value: {
      id: legacyCase.id,
      sourcePath: `cases/${legacyCase.id.toLowerCase()}.md`,
      text,
      title: legacyCase.title
    }
  };
}

function legacyEntryLocators(entry: string): readonly string[] {
  const direct = entry.match(/^(\S+) > (\S(?:.*\S)?)$/u);
  if (direct !== null) {
    return [entry, `${projectRelativeFile(direct[1]!)} > ${direct[2]!}`];
  }
  const selector = entry.match(
    /^(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)*(?:bun test|node --test) --test-name-pattern=(?:"\^(.+)\$"|'\^(.+)\$') (?:\.\/)?([^\s]+)$/u
  );
  if (selector === null) {
    throw new MigrationError(
      `legacy Entry is not an exact file/full-name locator: ${entry}`
    );
  }
  const name = unescapeSelectorName(selector[1] ?? selector[2] ?? "");
  const file = projectRelativeFile(selector[3]!);
  if (name === "") {
    throw new MigrationError("is not an exact file/full-name locator");
  }
  const runner = entry.includes("bun test") ? "bun test" : "node --test";
  const normalizedSelectors = [file, `./${file}`].map(
    (selectorFile) =>
      `${runner} --test-name-pattern="^${escapeSelectorName(name)}$" ${selectorFile}`
  );
  return uniqueSorted([entry, ...normalizedSelectors, `${file} > ${name}`]);
}

function projectRelativeFile(value: string): string {
  const normalized = value.replace(/^\.\//u, "");
  if (!isProjectRelativePath(normalized)) {
    throw new MigrationError("is not an exact file/full-name locator");
  }
  return normalized;
}

function unescapeSelectorName(value: string): string {
  return value.replace(/\\(.)/gu, "$1");
}

function escapeSelectorName(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function assertNewCases(cases: readonly ConvertedCase[]): void {
  if (
    new Set(cases.map((entry) => entry.id)).size !== cases.length ||
    new Set(cases.map((entry) => entry.sourcePath)).size !== cases.length
  ) {
    throw new MigrationError("converted Case identities or paths collide");
  }
}

export async function assertTargetsAvailable(
  root: string,
  cases: readonly ConvertedCase[]
): Promise<void> {
  const casesDirectory = path.join(root, "cases");
  if (await exists(casesDirectory)) {
    throw new MigrationError(
      `${legacyRoot}/cases already exists; migration refuses to merge into an existing target`
    );
  }
  for (const converted of cases) {
    if (await exists(path.join(root, ...converted.sourcePath.split("/")))) {
      throw new MigrationError(
        `target already exists: ${legacyRoot}/${converted.sourcePath}`
      );
    }
  }
}

export function buildMigrationIndex(
  cases: readonly ConvertedCase[]
): MigrationIndex {
  const entries: Record<
    string,
    {
      sourcePath: string;
      tags: readonly string[];
      testIds: readonly string[];
      title: string;
    }
  > = Object.create(null);
  const revisions: Record<string, string> = Object.create(null);
  for (const entry of [...cases].sort((a, b) => compare(a.id, b.id))) {
    const parsed = parseConvertedCase(entry.text);
    entries[entry.id] = {
      title: entry.title,
      sourcePath: entry.sourcePath,
      tags: parsed.tags,
      testIds: parsed.tests
    };
    revisions[entry.id] = sha256(
      JSON.stringify([entry.sourcePath, entry.text.replace(/\r\n/gu, "\n")])
    );
  }
  return {
    schemaVersion: 4,
    namespace: "test-evidence",
    definitionVersion: 6,
    metadata: {},
    sourceRevision: { entries: revisions, metadata: sha256("{}") },
    entries
  };
}

function parseConvertedCase(text: string): {
  tags: string[];
  tests: string[];
} {
  const tests = valuesAfter(text, "Tests:");
  const tags = valuesAfter(text, "Tags:");
  if (
    tests.length === 0 ||
    tags.length === 0 ||
    !isSorted(tests) ||
    !isSorted(tags) ||
    new Set(tests).size !== tests.length ||
    new Set(tags).size !== tags.length ||
    !tags.every((tag) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tag))
  ) {
    throw new MigrationError("generated Case violates D1");
  }
  return { tags, tests };
}

function valuesAfter(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  const values: string[] = [];
  for (
    let index = start + 1;
    index < lines.length && (lines[index] ?? "") !== "";
    index += 1
  ) {
    const match = lines[index]?.match(/^- `([^`\r\n]+)`$/u);
    if (match === null || match === undefined) return [];
    values.push(match[1]!);
  }
  return values;
}
