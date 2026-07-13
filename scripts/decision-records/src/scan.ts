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
  requireSingleField,
  stripLinkSuffix
} from "./markdown.ts";
import {
  decisionRelationTypes,
  decisionStatusSet,
  type DecisionRelation,
  type DecisionRecord,
  type DecisionRelationType,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionStatus,
  type MarkdownSection
} from "./types.ts";

const allowedRootFiles = new Set([
  "decision-record-index.md"
]);
const sectionOrder = [
  "## 状态",
  "## 问题",
  "## 背景与约束",
  "## 决策过程",
  "## 决定",
  "## 影响",
  "## 验证"
];
const requiredSections = new Set([
  "## 状态",
  "## 问题",
  "## 决定",
  "## 影响",
  "## 验证"
]);
const impactAreaPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const decisionFilePattern = /^(\d{6})-([a-z]+)-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const decisionRelativePathPattern = /^(?:archive\/)?[a-z0-9]+(?:-[a-z0-9]+)*\/\d{6}-[a-z]+-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const decisionRelationTypeSet: ReadonlySet<string> = new Set(decisionRelationTypes);
const relationExpectedStatus: Record<DecisionRelationType, DecisionStatus> = {
  "修订": "amended",
  "替代": "superseded",
  "判定无效": "invalidated",
  "归并": "superseded"
};

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
  status: string;
  titleSlug: string;
} | null {
  const match = fileName.match(decisionFilePattern);
  if (!match) {
    return null;
  }

  return {
    datePrefix: match[1],
    status: match[2],
    titleSlug: match[3]
  };
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
  relativePath: string;
  statusSection: string;
}): Promise<DecisionRelation[]> {
  const {
    decisionPath,
    decisionsDirectory,
    errors,
    relativePath,
    statusSection
  } = options;
  const subheadings = [...statusSection.matchAll(/^### ([^\n]+)$/gm)];
  const relationHeadings = subheadings.filter((match) => match[1].trim() === "关系");

  for (const heading of subheadings) {
    if (heading[1].trim() !== "关系") {
      errors.push(relativePath + " has unsupported status subsection ### " + heading[1].trim());
    }
  }

  if (relationHeadings.length > 1) {
    errors.push(relativePath + " contains status subsection ### 关系 more than once");
  }

  const heading = relationHeadings[0];
  if (!heading) {
    return [];
  }

  const headingIndex = heading.index ?? 0;
  const lineEnd = statusSection.indexOf("\n", headingIndex);
  const contentStart = lineEnd >= 0 ? lineEnd + 1 : statusSection.length;
  const nextHeading = subheadings.find((candidate) => (candidate.index ?? 0) > headingIndex);
  const contentEnd = nextHeading?.index ?? statusSection.length;
  const relationContent = statusSection.slice(contentStart, contentEnd).trim();
  if (relationContent.length === 0) {
    errors.push(relativePath + " status subsection ### 关系 must not be empty");
    return [];
  }

  const relations: DecisionRelation[] = [];
  const relationKeys = new Set<string>();
  for (const line of relationContent.split("\n").map((value) => value.trim()).filter(Boolean)) {
    const match = line.match(/^- ([^:]+):\s*(.*?)\s*$/);
    const relationType = match?.[1].trim();
    if (!match || !relationType || !decisionRelationTypeSet.has(relationType)) {
      errors.push(relativePath + " has unsupported relationship entry: " + line);
      continue;
    }

    const links = extractMarkdownLinks(match[2]).targets.filter(
      (target) => target.kind === "link"
    );
    if (links.length === 0) {
      errors.push(relativePath + " relationship " + relationType + " must use an inline Markdown decision link");
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

      const relationKey = relationType + "\u0000" + target;
      if (relationKeys.has(relationKey)) {
        errors.push(relativePath + " repeats relationship " + relationType + " target " + target);
        continue;
      }

      relationKeys.add(relationKey);
      relations.push({
        target,
        type: relationType as DecisionRelationType
      });
    }
  }

  return relations;
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

      const expectedStatus = relationExpectedStatus[relation.type];
      if (target.fileStatus !== expectedStatus) {
        errors.push(
          record.relativePath
          + " relationship " + relation.type
          + " target must have status " + expectedStatus
          + ": " + relation.target
        );
      }

      if (!target.statusCauseTargets.includes(record.relativePath)) {
        errors.push(
          record.relativePath
          + " relationship " + relation.type
          + " target must link back through 导致状态变化的决策: " + relation.target
        );
      }
    }
  }
}

async function validateDecisionBody(options: {
  archived: boolean;
  body: string;
  decisionPath: string;
  decisionsDirectory: string;
  errors: string[];
  fileName: string;
  relativePath: string;
}): Promise<Omit<DecisionRecord, "archived" | "areaId" | "decisionPath" | "fileName" | "relativePath">> {
  const {
    archived,
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
  const fileStatus = parsedFileName?.status;
  const fullDate = fullDateFromCompactPrefix(datePrefix);
  const expectedTitlePrefix = "# " + (fullDate ?? "YYYY-MM-DD") + " - ";
  const firstLine = body.split("\n", 1)[0];
  const title = firstLine.startsWith(expectedTitlePrefix)
    ? firstLine.slice(expectedTitlePrefix.length).trim()
    : "";

  if (!parsedFileName) {
    errors.push(relativePath + " must use file name format YYMMDD-<status>-short-title.md");
  }

  if (!fullDate) {
    errors.push(relativePath + " has an invalid date prefix");
  }

  if (fileStatus && !decisionStatusSet.has(fileStatus)) {
    errors.push(relativePath + " has unsupported status " + fileStatus);
  }

  if (title.length === 0) {
    errors.push(relativePath + " must start with \"" + expectedTitlePrefix + "<标题>\"");
  }

  if (fileStatus === "invalidated" && !archived) {
    errors.push(relativePath + " invalidated decisions must be stored under archive/<impact-area>/");
  }

  if (archived && fileStatus && fileStatus !== "invalidated") {
    errors.push(relativePath + " archive may contain only invalidated decisions");
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

  let bodyStatus: string | null = null;
  let relations: DecisionRelation[] = [];
  const statusCauseTargets: string[] = [];
  const statusSection = sectionMap.get("## 状态")?.[0]?.content;
  if (statusSection) {
    bodyStatus = requireSingleField(relativePath, statusSection, "当前状态", errors);
    const cause = requireSingleField(relativePath, statusSection, "导致状态变化的决策", errors);
    requireSingleField(relativePath, statusSection, "状态说明", errors);

    if (bodyStatus && fileStatus && bodyStatus !== fileStatus) {
      errors.push(relativePath + " body status " + bodyStatus + " does not match file status " + fileStatus);
    }

    if (bodyStatus && !decisionStatusSet.has(bodyStatus)) {
      errors.push(relativePath + " body has unsupported status " + bodyStatus);
    }

    if (cause && fileStatus === "active" && cause !== "无") {
      errors.push(relativePath + " active decisions must use \"无\" as status cause");
    }

    if (cause && fileStatus && fileStatus !== "active") {
      if (cause === "无") {
        errors.push(relativePath + " non-active decisions must link to the later decision");
      } else {
        const causeLinks = extractMarkdownLinks(cause).targets.filter(
          (target) => target.kind === "link"
        );
        if (causeLinks.length === 0) {
          errors.push(relativePath + " non-active status cause must use an inline Markdown decision link");
        }

        for (const link of causeLinks) {
          const target = await validateDecisionLink({
            baseDirectory: path.dirname(decisionPath),
            decisionsDirectory,
            errors,
            rawTarget: link.target,
            relativeSourcePath: relativePath
          });

          if (target === relativePath) {
            errors.push(relativePath + " must not use itself as a status cause");
          }

          if (target) {
            statusCauseTargets.push(target);
          }
        }
      }
    }

    relations = await validateDecisionRelations({
      decisionPath,
      decisionsDirectory,
      errors,
      relativePath,
      statusSection
    });
  }

  const decisionSection = sectionMap.get("## 决定")?.[0]?.content;
  if (decisionSection) {
    requireNonEmptyField(relativePath, decisionSection, "采用", errors);
    requireNonEmptyField(relativePath, decisionSection, "触发条件", errors);
  }

  return {
    bodyStatus,
    datePrefix,
    fileStatus,
    fullDate,
    relations,
    statusCauseTargets,
    title
  };
}

async function scanArea(options: {
  archived: boolean;
  areaId: string;
  areaPath: string;
  decisionsDirectory: string;
  errors: string[];
  records: DecisionRecord[];
}): Promise<void> {
  const {
    archived,
    areaId,
    areaPath,
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
    errors.push(
      (archived ? "Archived decision area" : "Decision impact area")
      + " must contain at least one decision file: "
      + areaId
    );
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
      archived,
      body,
      decisionPath,
      decisionsDirectory,
      errors,
      fileName: entry.name,
      relativePath
    });

    records.push({
      archived,
      areaId,
      decisionPath,
      fileName: entry.name,
      relativePath,
      ...metadata
    });
  }
}

async function scanArchive(options: {
  archivePath: string;
  areaIds: Set<string>;
  decisionsDirectory: string;
  errors: string[];
  records: DecisionRecord[];
}): Promise<void> {
  const {
    archivePath,
    areaIds,
    decisionsDirectory,
    errors,
    records
  } = options;
  const archiveEntries = await fs.readdir(archivePath, { withFileTypes: true });
  archiveEntries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of archiveEntries) {
    const entryPath = path.join(archivePath, entry.name);
    if (!entry.isDirectory()) {
      errors.push("docs/decisions/archive may contain only impact-area directories: " + entry.name);
      continue;
    }

    const areaId = entry.name;
    areaIds.add(areaId);
    if (!impactAreaPattern.test(areaId)) {
      errors.push("Archived decision impact area must use kebab-case: " + areaId);
    }

    await scanArea({
      archived: true,
      areaId,
      areaPath: entryPath,
      decisionsDirectory,
      errors,
      records
    });
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
  const indexPath = path.join(decisionsDirectory, "decision-record-index.md");
  const indexRelativePath = displayPath(workspaceRoot, indexPath);

  if (!await pathExists(decisionsDirectory)) {
    return {
      areaIds,
      decisionsDirectory,
      errors: [decisionsLabel + " is required"],
      index: "",
      indexPath,
      indexRelativePath,
      records,
      workspaceRoot
    };
  }

  const decisionsStat = await fs.stat(decisionsDirectory);
  if (!decisionsStat.isDirectory()) {
    return {
      areaIds,
      decisionsDirectory,
      errors: [decisionsLabel + " must be a directory"],
      index: "",
      indexPath,
      indexRelativePath,
      records,
      workspaceRoot
    };
  }

  if (!await pathExists(indexPath)) {
    errors.push(indexRelativePath + " is required");
  }

  const index = await pathExists(indexPath) ? await fs.readFile(indexPath, "utf8") : "";
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

    if (entry.name === "archive") {
      await scanArchive({
        archivePath: entryPath,
        areaIds,
        decisionsDirectory,
        errors,
        records
      });
      continue;
    }

    const areaId = entry.name;
    areaIds.add(areaId);
    if (!impactAreaPattern.test(areaId)) {
      errors.push("Decision impact area must use kebab-case: " + areaId);
    }

    await scanArea({
      archived: false,
      areaId,
      areaPath: entryPath,
      decisionsDirectory,
      errors,
      records
    });
  }

  const backtick = String.fromCharCode(96);
  for (const areaId of [...areaIds].sort()) {
    if (!index.includes(backtick + areaId + backtick)) {
      errors.push(indexRelativePath + " must describe impact area " + areaId);
    }
  }

  validateDecisionRelationConsistency(records, errors);

  return {
    areaIds,
    decisionsDirectory,
    errors,
    index,
    indexPath,
    indexRelativePath,
    records,
    workspaceRoot
  };
}
