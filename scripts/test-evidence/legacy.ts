import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const legacyRoot = "docs/test-evidence";
export const legacyTopicsFile = "test-evidence-topics.json";
export const legacyIndexFile = "test-evidence-index.json";
export const caseIdPattern = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-[0-9]{3}$/u;
const topicIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export type LegacyCase = Readonly<{
  contract: readonly string[];
  entries: readonly string[];
  id: string;
  proves: readonly string[];
  sourcePath: string;
  title: string;
  topicId: string;
}>;

export type LegacyCatalog = Readonly<{
  cases: readonly LegacyCase[];
  fingerprints: Readonly<Record<string, string>>;
}>;

export class LegacyCatalogError extends Error {}

export async function loadLegacyCatalog(
  workspaceRoot: string
): Promise<LegacyCatalog> {
  const root = path.join(workspaceRoot, ...legacyRoot.split("/"));
  const rootStat = await lstatOrNull(root);
  if (
    rootStat === null ||
    !rootStat.isDirectory() ||
    rootStat.isSymbolicLink()
  ) {
    throw new LegacyCatalogError(`${legacyRoot} must be a real directory`);
  }
  const topicPath = path.join(root, legacyTopicsFile);
  const topicText = await readOrdinaryUtf8(
    topicPath,
    `${legacyRoot}/${legacyTopicsFile}`
  );
  const topics = parseTopics(topicText);
  const allowed = new Set([legacyTopicsFile, legacyIndexFile, ...topics]);
  const rootEntries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isSymbolicLink() || !allowed.has(entry.name)) {
      throw new LegacyCatalogError(
        `${legacyRoot}/${entry.name} is not allowed`
      );
    }
    if (topics.includes(entry.name) !== entry.isDirectory()) {
      throw new LegacyCatalogError(
        `${legacyRoot}/${entry.name} has an invalid type`
      );
    }
  }

  const cases: LegacyCase[] = [];
  const fingerprints: Record<string, string> = Object.create(null);
  for (const topicId of topics) {
    const topicDirectory = path.join(root, topicId);
    const stat = await lstatOrNull(topicDirectory);
    if (stat === null) continue;
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new LegacyCatalogError(
        `${legacyRoot}/${topicId} must be a real directory`
      );
    }
    const entries = await fs.readdir(topicDirectory, { withFileTypes: true });
    if (entries.length === 0) {
      throw new LegacyCatalogError(
        `${legacyRoot}/${topicId} must not be empty when present`
      );
    }
    for (const entry of entries.sort((a, b) => compare(a.name, b.name))) {
      if (
        entry.isSymbolicLink() ||
        !entry.isFile() ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(entry.name)
      ) {
        throw new LegacyCatalogError(
          `${legacyRoot}/${topicId}/${entry.name} must be a regular semantic Markdown file`
        );
      }
      const sourcePath = `${legacyRoot}/${topicId}/${entry.name}`;
      const text = await readOrdinaryUtf8(
        path.join(topicDirectory, entry.name),
        sourcePath
      );
      const legacyCase = parseLegacyCase(text, sourcePath, topicId);
      if (fingerprints[legacyCase.id] !== undefined) {
        throw new LegacyCatalogError(
          `duplicate legacy Case ID: ${legacyCase.id}`
        );
      }
      fingerprints[legacyCase.id] = sha256(text);
      cases.push(legacyCase);
    }
  }
  cases.sort((left, right) => compare(left.id, right.id));
  return { cases, fingerprints };
}

function parseTopics(text: string): string[] {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new LegacyCatalogError(
      `${legacyRoot}/${legacyTopicsFile} is invalid JSON`
    );
  }
  if (
    !isRecord(input) ||
    Object.keys(input).length !== 2 ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.topics) ||
    input.topics.length === 0
  ) {
    throw new LegacyCatalogError(
      `${legacyRoot}/${legacyTopicsFile} must contain the legacy topic table`
    );
  }
  const topics: string[] = [];
  for (const topic of input.topics) {
    if (
      !isRecord(topic) ||
      Object.keys(topic).length !== 2 ||
      typeof topic.id !== "string" ||
      typeof topic.description !== "string" ||
      !topicIdPattern.test(topic.id) ||
      topic.description.trim() !== topic.description ||
      /[\r\n]/u.test(topic.description) ||
      Array.from(topic.description).length < 4 ||
      Array.from(topic.description).length > 200
    ) {
      throw new LegacyCatalogError(
        `${legacyRoot}/${legacyTopicsFile} contains an invalid topic`
      );
    }
    topics.push(topic.id);
  }
  if (new Set(topics).size !== topics.length || !isSorted(topics)) {
    throw new LegacyCatalogError(
      `${legacyRoot}/${legacyTopicsFile} topic IDs must be unique and sorted`
    );
  }
  return topics;
}

function parseLegacyCase(
  text: string,
  sourcePath: string,
  topicId: string
): LegacyCase {
  const lines = text.split(/\r?\n/u);
  const heading = lines[0]?.match(
    /^### Case ([A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-[0-9]{3}): (\S(?:.*\S)?)$/u
  );
  if (
    heading === null ||
    heading === undefined ||
    !caseIdPattern.test(heading[1] ?? "")
  ) {
    throw new LegacyCatalogError(
      `${sourcePath} must start with a valid legacy Case heading`
    );
  }
  const sections: Record<"Entry" | "Contract" | "Proves", string[]> = {
    Entry: [],
    Contract: [],
    Proves: []
  };
  const declarations = new Map<string, number>();
  let active: keyof typeof sections | null = null;
  for (const rawLine of lines.slice(1)) {
    const line = rawLine.replace(/\r$/u, "");
    const section = line.match(/^(Entry|Contract|Proves):\s*$/u)?.[1] as
      | keyof typeof sections
      | undefined;
    if (section !== undefined) {
      declarations.set(section, (declarations.get(section) ?? 0) + 1);
      active = section;
      continue;
    }
    if (line.startsWith("Verification:"))
      throw new LegacyCatalogError(
        `${sourcePath} must not declare Verification`
      );
    const list = line.trim().match(/^(?:[-*]|\d+\.)\s+(\S.*)$/u)?.[1];
    if (active !== null && list !== undefined) {
      sections[active].push(list);
      continue;
    }
    if (line.trim() !== "") active = null;
  }
  for (const name of ["Entry", "Contract", "Proves"] as const) {
    if (declarations.get(name) !== 1 || sections[name].length === 0) {
      throw new LegacyCatalogError(
        `${sourcePath} must include exactly one non-empty ${name} list`
      );
    }
  }
  const entries = sections.Entry.map((value) => {
    const match = value.match(/^`([^`\r\n]+)`$/u);
    const entry = match?.[1]?.trim() ?? "";
    if (entry === "")
      throw new LegacyCatalogError(`${sourcePath} has an invalid Entry`);
    return entry;
  });
  if (new Set(entries).size !== entries.length)
    throw new LegacyCatalogError(`${sourcePath} has duplicate Entry values`);
  for (const name of ["Contract", "Proves"] as const) {
    if (sections[name].some((value) => value.trim() === ""))
      throw new LegacyCatalogError(`${sourcePath} has an empty ${name} item`);
  }
  return {
    contract: sections.Contract,
    entries,
    id: heading[1]!,
    proves: sections.Proves,
    sourcePath,
    title: heading[2]!,
    topicId
  };
}

async function readOrdinaryUtf8(
  filePath: string,
  label: string
): Promise<string> {
  const stat = await lstatOrNull(filePath);
  if (stat === null || !stat.isFile() || stat.isSymbolicLink())
    throw new LegacyCatalogError(`${label} must be a regular file`);
  const data = await fs.readFile(filePath);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  return text;
}
async function lstatOrNull(filePath: string) {
  try {
    return await fs.lstat(filePath);
  } catch (error: unknown) {
    if (isRecord(error) && error.code === "ENOENT") return null;
    throw error;
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? "") < value
  );
}
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
