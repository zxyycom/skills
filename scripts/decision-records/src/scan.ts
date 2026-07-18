import fs from "node:fs/promises";
import path from "node:path";
import {
  isPathWithinDirectory,
  pathExists,
  toPosix
} from "../../lib/filesystem.ts";
import { extractMarkdownLinks } from "../../lib/markdown-links.ts";
import {
  parseSections,
  requireNonEmptyField,
  requireOnlyFields,
  requireSingleField,
  stripLinkSuffix
} from "./markdown.ts";
import {
  decisionRelationTypes,
  type DecisionIndex,
  type DecisionIndexEntry,
  type DecisionRecord,
  type DecisionRelation,
  type DecisionRelationType,
  type DecisionScan,
  type DecisionScanOptions,
  type MarkdownSection
} from "./types.ts";

const indexFileName = "decision-index.json";
const allowedRootFiles = new Set([indexFileName]);
const sectionOrder = [
  "## 索引摘要",
  "## 背景",
  "## 决定",
  "## 关系"
];
const requiredSections = new Set([
  "## 索引摘要",
  "## 背景",
  "## 决定"
]);
const impactAreaPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const decisionFilePattern = /^(\d{6})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const decisionRelativePathPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\/\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const decisionRelationTypeSet: ReadonlySet<string> = new Set(decisionRelationTypes);
const allowedRelationLabels = new Set<string>(decisionRelationTypes);

function displayPath(workspaceRoot: string, targetPath: string): string {
  const relativePath = path.relative(workspaceRoot, targetPath);
  if (relativePath === "") {
    return ".";
  }

  if (relativePath === ".."
    || relativePath.startsWith(".." + path.sep)
    || path.isAbsolute(relativePath)) {
    return targetPath;
  }

  return toPosix(relativePath);
}

function fullDateFromCompactPrefix(dateText: string): string | null {
  const match = dateText.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) {
    return null;
  }

  return String(year) + "-" + match[2] + "-" + match[3];
}

function parseDecisionFileName(fileName: string): {
  datePrefix: string;
  titleSlug: string;
} | null {
  const match = fileName.match(decisionFilePattern);
  if (!match) {
    return null;
  }

  return {
    datePrefix: match[1],
    titleSlug: match[2]
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIndex(indexText: string, indexRelativePath: string, errors: string[]): DecisionIndex | null {
  const initialErrorCount = errors.length;
  let parsed: unknown;
  try {
    parsed = JSON.parse(indexText);
  } catch (error) {
    errors.push(
      indexRelativePath
      + " must contain valid JSON: "
      + (error instanceof Error ? error.message : String(error))
    );
    return null;
  }

  if (!isObject(parsed)) {
    errors.push(indexRelativePath + " must contain a JSON object");
    return null;
  }

  const rootKeys = Object.keys(parsed).sort();
  if (rootKeys.join(",") !== "current,schemaVersion") {
    errors.push(indexRelativePath + " must contain only schemaVersion and current");
  }

  if (parsed.schemaVersion !== 1) {
    errors.push(indexRelativePath + " schemaVersion must be 1");
  }

  if (!Array.isArray(parsed.current)) {
    errors.push(indexRelativePath + " current must be an array");
    return null;
  }

  const current: DecisionIndexEntry[] = [];
  const seenPaths = new Set<string>();
  for (let index = 0; index < parsed.current.length; index += 1) {
    const value: unknown = parsed.current[index];
    const label = indexRelativePath + " current[" + index + "]";
    if (!isObject(value)) {
      errors.push(label + " must be an object");
      continue;
    }

    const keys = Object.keys(value).sort();
    if (keys.join(",") !== "background,decision,path,title") {
      errors.push(label + " must contain only path, title, background, and decision");
    }

    const recordPath = value.path;
    const title = value.title;
    const background = value.background;
    const decision = value.decision;
    if (typeof background !== "string" || background.trim().length === 0) {
      errors.push(label + " background must be a non-empty string");
      continue;
    }
    if (typeof decision !== "string" || decision.trim().length === 0) {
      errors.push(label + " decision must be a non-empty string");
      continue;
    }
    if (typeof recordPath !== "string" || !decisionRelativePathPattern.test(recordPath)) {
      errors.push(label + " path must be a relative decision path");
      continue;
    }
    if (typeof title !== "string" || title.trim().length === 0) {
      errors.push(label + " title must be a non-empty string");
      continue;
    }
    if (seenPaths.has(recordPath)) {
      errors.push(indexRelativePath + " repeats current decision " + recordPath);
      continue;
    }

    seenPaths.add(recordPath);
    current.push({ background, decision, path: recordPath, title });
  }

  return errors.length === initialErrorCount ? { current, schemaVersion: 1 } : null;
}

async function validateDecisionLink(options: {
  baseDirectory: string;
  decisionsDirectory: string;
  errors: string[];
  rawTarget: string;
  relativeSourcePath: string;
}): Promise<string | null> {
  const {
    baseDirectory,
    decisionsDirectory,
    errors,
    rawTarget,
    relativeSourcePath
  } = options;

  const target = stripLinkSuffix(rawTarget.trim());
  if (target.length === 0) {
    errors.push(relativeSourcePath + " decision link must target a file: " + rawTarget);
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    errors.push(relativeSourcePath + " decision link must be relative: " + rawTarget);
    return null;
  }

  if (target.includes("\\") || path.isAbsolute(target)) {
    errors.push(relativeSourcePath + " decision link must use a relative POSIX path: " + rawTarget);
    return null;
  }

  const resolvedTarget = path.resolve(baseDirectory, target);
  if (!isPathWithinDirectory(resolvedTarget, decisionsDirectory)) {
    errors.push(relativeSourcePath + " decision link points outside the decision directory: " + rawTarget);
    return null;
  }

  const relativeTarget = toPosix(path.relative(decisionsDirectory, resolvedTarget));
  if (!decisionRelativePathPattern.test(relativeTarget)) {
    errors.push(relativeSourcePath + " decision link has an invalid target path: " + rawTarget);
    return null;
  }

  if (!await pathExists(resolvedTarget)) {
    errors.push(relativeSourcePath + " decision link target does not exist: " + rawTarget);
    return null;
  }

  return relativeTarget;
}

async function validateDecisionRelations(options: {
  decisionPath: string;
  decisionsDirectory: string;
  errors: string[];
  relationSection: string;
  relativePath: string;
}): Promise<DecisionRelation[]> {
  const {
    decisionPath,
    decisionsDirectory,
    errors,
    relationSection,
    relativePath
  } = options;
  const relations: DecisionRelation[] = [];
  const relationKeys = new Set<string>();

  for (const line of relationSection.split("\n").map((value) => value.trim()).filter(Boolean)) {
    const match = line.match(/^- ([^:]+):\s*(.*?)\s*$/);
    const label = match?.[1].trim();
    if (!match || !label || !allowedRelationLabels.has(label)) {
      errors.push(relativePath + " has unsupported relationship entry: " + line);
      continue;
    }

    const links = extractMarkdownLinks(match[2]).targets.filter(
      (target) => target.kind === "link"
    );
    if (links.length === 0) {
      errors.push(relativePath + " relationship " + label + " must use an inline Markdown decision link");
      continue;
    }

    for (const link of links) {
      const target = await validateDecisionLink({
        baseDirectory: path.dirname(decisionPath),
        decisionsDirectory,
        errors,
        rawTarget: link.target,
        relativeSourcePath: relativePath
      });
      if (!target) {
        continue;
      }
      if (target === relativePath) {
        errors.push(relativePath + " must not relate to itself");
        continue;
      }

      const relationKey = label + "\u0000" + target;
      if (relationKeys.has(relationKey)) {
        errors.push(relativePath + " repeats relationship " + label + " target " + target);
        continue;
      }
      relationKeys.add(relationKey);

      if (decisionRelationTypeSet.has(label)) {
        relations.push({ target, type: label as DecisionRelationType });
      }
    }
  }

  return relations;
}

async function validateDecisionBody(options: {
  body: string;
  decisionPath: string;
  decisionsDirectory: string;
  errors: string[];
  fileName: string;
  relativePath: string;
}): Promise<Omit<DecisionRecord, "archived" | "areaId" | "current" | "decisionPath" | "fileName" | "relativePath">> {
  const {
    body: rawBody,
    decisionPath,
    decisionsDirectory,
    fileName,
    relativePath,
    errors
  } = options;
  const body = rawBody.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const parsedFileName = parseDecisionFileName(fileName);
  const datePrefix = parsedFileName?.datePrefix ?? fileName.slice(0, 6);
  const fullDate = fullDateFromCompactPrefix(datePrefix);
  const expectedTitlePrefix = "# " + (fullDate ?? "YYYY-MM-DD") + " - ";
  const firstLine = body.split("\n", 1)[0];
  const title = firstLine.startsWith(expectedTitlePrefix)
    ? firstLine.slice(expectedTitlePrefix.length).trim()
    : "";

  if (!parsedFileName) {
    errors.push(relativePath + " must use stable file name format YYMMDD-short-title.md");
  }
  if (!fullDate) {
    errors.push(relativePath + " has an invalid date prefix");
  }
  if (title.length === 0) {
    errors.push(relativePath + " must start with \"" + expectedTitlePrefix + "<标题>\"");
  }

  const sections = parseSections(body);
  const sectionMap = new Map<string, MarkdownSection[]>();
  const expectedSectionSet = new Set(sectionOrder);

  for (const section of sections) {
    if (!expectedSectionSet.has(section.heading)) {
      errors.push(relativePath + " has unsupported section " + section.heading);
      continue;
    }

    const existing = sectionMap.get(section.heading) ?? [];
    existing.push(section);
    sectionMap.set(section.heading, existing);
  }

  for (const sectionHeading of requiredSections) {
    if (!sectionMap.has(sectionHeading)) {
      errors.push(relativePath + " is missing section " + sectionHeading);
    }
  }

  for (const [sectionHeading, entries] of sectionMap) {
    if (entries.length > 1) {
      errors.push(relativePath + " contains section " + sectionHeading + " more than once");
    }
    for (const entry of entries) {
      if (entry.content.length === 0) {
        errors.push(relativePath + " section " + sectionHeading + " must not be empty");
      }
    }
  }

  let previousOrder = -1;
  for (const section of sections) {
    const currentOrder = sectionOrder.indexOf(section.heading);
    if (currentOrder < 0) {
      continue;
    }
    if (currentOrder < previousOrder) {
      errors.push(relativePath + " has sections out of order");
      break;
    }
    previousOrder = currentOrder;
  }

  let background = "";
  let decision = "";
  const summarySection = sectionMap.get("## 索引摘要")?.[0]?.content;
  if (summarySection) {
    requireOnlyFields(
      relativePath,
      summarySection,
      "## 索引摘要",
      ["背景", "决策"],
      errors
    );
    background = requireSingleField(
      relativePath,
      summarySection,
      "背景",
      errors
    ) ?? "";
    decision = requireSingleField(
      relativePath,
      summarySection,
      "决策",
      errors
    ) ?? "";
  }

  const decisionSection = sectionMap.get("## 决定")?.[0]?.content;
  if (decisionSection) {
    requireNonEmptyField(relativePath, decisionSection, "采用", errors);
  }

  let relations: DecisionRelation[] = [];
  const relationSection = sectionMap.get("## 关系")?.[0]?.content;
  if (relationSection) {
    relations = await validateDecisionRelations({
      decisionPath,
      decisionsDirectory,
      errors,
      relationSection,
      relativePath
    });
  }

  return {
    background,
    datePrefix,
    decision,
    fullDate,
    relations,
    title
  };
}

async function scanArea(options: {
  areaId: string;
  areaPath: string;
  currentPaths: Set<string>;
  decisionsDirectory: string;
  errors: string[];
  records: DecisionRecord[];
}): Promise<void> {
  const {
    areaId,
    areaPath,
    currentPaths,
    decisionsDirectory,
    errors,
    records
  } = options;
  const areaEntries = await fs.readdir(areaPath, { withFileTypes: true });
  areaEntries.sort((left, right) => left.name.localeCompare(right.name));
  const markdownFiles = areaEntries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".md")
  );

  if (markdownFiles.length === 0) {
    errors.push("Decision area must contain at least one decision file: " + areaId);
  }

  for (const entry of areaEntries) {
    const relativePath = toPosix(path.relative(
      decisionsDirectory,
      path.join(areaPath, entry.name)
    ));

    if (entry.isDirectory()) {
      errors.push("Decision area must not contain nested directories: " + relativePath);
      continue;
    }
    if (!entry.isFile()) {
      errors.push("Decision area contains unsupported entry: " + relativePath);
      continue;
    }
    if (!entry.name.endsWith(".md")) {
      errors.push("Decision area must contain only Markdown files: " + relativePath);
      continue;
    }

    const decisionPath = path.join(areaPath, entry.name);
    const body = await fs.readFile(decisionPath, "utf8");
    const metadata = await validateDecisionBody({
      body,
      decisionPath,
      decisionsDirectory,
      errors,
      fileName: entry.name,
      relativePath
    });
    const current = currentPaths.has(relativePath);

    records.push({
      archived: !current,
      areaId,
      current,
      decisionPath,
      fileName: entry.name,
      relativePath,
      ...metadata
    });
  }
}

function validateIndexEntries(
  index: DecisionIndex | null,
  records: DecisionRecord[],
  indexRelativePath: string,
  errors: string[]
): void {
  if (!index) {
    return;
  }

  const recordByPath = new Map(records.map((record) => [record.relativePath, record]));
  for (const entry of index.current) {
    const record = recordByPath.get(entry.path);
    if (!record) {
      errors.push(indexRelativePath + " references missing decision " + entry.path);
    }
  }
}

function validateDecisionRelationConsistency(records: DecisionRecord[], errors: string[]): void {
  const recordByPath = new Map(records.map((record) => [record.relativePath, record]));

  for (const record of records) {
    for (const relation of record.relations) {
      const target = recordByPath.get(relation.target);
      if (!target) {
        errors.push(record.relativePath + " relationship target is not a scanned decision: " + relation.target);
        continue;
      }
      if (target.current) {
        errors.push(
          record.relativePath
          + " relationship " + relation.type
          + " target must be archived: " + relation.target
        );
      }
    }
  }

  const visitState = new Map<string, "visiting" | "visited">();
  const pathStack: string[] = [];

  function visit(recordPath: string): void {
    visitState.set(recordPath, "visiting");
    pathStack.push(recordPath);

    const record = recordByPath.get(recordPath);
    const targets = [...new Set(record?.relations.map((relation) => relation.target) ?? [])]
      .filter((target) => recordByPath.has(target))
      .sort();
    for (const target of targets) {
      const targetState = visitState.get(target);
      if (targetState === "visiting") {
        const cycleStart = pathStack.indexOf(target);
        const cycle = [...pathStack.slice(cycleStart), target];
        errors.push("Decision relations must not form a cycle: " + cycle.join(" -> "));
        continue;
      }
      if (targetState !== "visited") {
        visit(target);
      }
    }

    pathStack.pop();
    visitState.set(recordPath, "visited");
  }

  for (const recordPath of [...recordByPath.keys()].sort()) {
    if (!visitState.has(recordPath)) {
      visit(recordPath);
    }
  }
}

export async function scanDecisionRecords(options: DecisionScanOptions = {}): Promise<DecisionScan> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const configuredDecisionDirectory = options.decisionsDir ?? "docs/decisions";
  const decisionsDirectory = path.isAbsolute(configuredDecisionDirectory)
    ? path.resolve(configuredDecisionDirectory)
    : path.resolve(workspaceRoot, configuredDecisionDirectory);
  const errors: string[] = [];
  const records: DecisionRecord[] = [];
  const areaIds = new Set<string>();
  const decisionsLabel = displayPath(workspaceRoot, decisionsDirectory);
  const indexPath = path.join(decisionsDirectory, indexFileName);
  const indexRelativePath = displayPath(workspaceRoot, indexPath);

  if (!await pathExists(decisionsDirectory)) {
    return {
      areaIds,
      currentPaths: new Set(),
      decisionsDirectory,
      errors: [decisionsLabel + " is required"],
      index: null,
      indexPath,
      indexRelativePath,
      indexText: "",
      records,
      workspaceRoot
    };
  }

  const decisionsStat = await fs.stat(decisionsDirectory);
  if (!decisionsStat.isDirectory()) {
    return {
      areaIds,
      currentPaths: new Set(),
      decisionsDirectory,
      errors: [decisionsLabel + " must be a directory"],
      index: null,
      indexPath,
      indexRelativePath,
      indexText: "",
      records,
      workspaceRoot
    };
  }

  if (!await pathExists(indexPath)) {
    errors.push(indexRelativePath + " is required");
  }
  const indexText = await pathExists(indexPath) ? await fs.readFile(indexPath, "utf8") : "";
  const index = indexText.length > 0 ? parseIndex(indexText, indexRelativePath, errors) : null;
  const currentPaths = new Set(index?.current.map((entry) => entry.path) ?? []);
  const rootEntries = await fs.readdir(decisionsDirectory, { withFileTypes: true });
  rootEntries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of rootEntries) {
    const entryPath = path.join(decisionsDirectory, entry.name);
    if (entry.isFile()) {
      if (!allowedRootFiles.has(entry.name)) {
        errors.push(decisionsLabel + " root contains unsupported file " + entry.name);
      }
      continue;
    }
    if (!entry.isDirectory()) {
      errors.push(decisionsLabel + " contains unsupported entry " + entry.name);
      continue;
    }

    const areaId = entry.name;
    areaIds.add(areaId);
    if (!impactAreaPattern.test(areaId)) {
      errors.push("Decision area must use kebab-case: " + areaId);
    }
    await scanArea({
      areaId,
      areaPath: entryPath,
      currentPaths,
      decisionsDirectory,
      errors,
      records
    });
  }

  validateIndexEntries(index, records, indexRelativePath, errors);
  validateDecisionRelationConsistency(records, errors);

  return {
    areaIds,
    currentPaths,
    decisionsDirectory,
    errors,
    index,
    indexPath,
    indexRelativePath,
    indexText,
    records,
    workspaceRoot
  };
}
