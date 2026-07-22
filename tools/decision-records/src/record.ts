import path from "node:path";
import {
  isPathWithinDirectory,
  pathExists,
  toPosix
} from "../../shared/src/node/filesystem.ts";
import { extractMarkdownLinks } from "../../shared/src/markdown/links.ts";
import {
  parseSections,
  requireNonEmptyField,
  requireOnlyFields,
  requireSingleField,
  stripLinkSuffix
} from "./markdown.ts";
import {
  decisionMetadataFromCandidate,
  parseDecisionMarkdown
} from "./decision-metadata.ts";
import {
  isDecisionFileName,
  isDecisionRelativePath
} from "./decision-path.ts";
import { projectionTextIssue } from "./projection.ts";
import {
  decisionRelationTypes,
  type DecisionDocument,
  type DecisionRelation,
  type DecisionRelationType,
  type MarkdownSection
} from "./types.ts";

const sectionOrder = [
  "## 索引摘要",
  "## 目的",
  "## 背景",
  "## 决策",
  "## 关系"
];
const requiredSections = new Set([
  "## 索引摘要",
  "## 目的",
  "## 背景",
  "## 决策"
]);
const decisionRelationTypeSet: ReadonlySet<string> = new Set(decisionRelationTypes);

function isDecisionRelationType(value: string): value is DecisionRelationType {
  return decisionRelationTypeSet.has(value);
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
    errors.push(
      relativeSourcePath + " decision link must use a relative POSIX path: " + rawTarget
    );
    return null;
  }

  const resolvedTarget = path.resolve(baseDirectory, target);
  if (!isPathWithinDirectory(resolvedTarget, decisionsDirectory)) {
    errors.push(
      relativeSourcePath + " decision link points outside the decision directory: " + rawTarget
    );
    return null;
  }

  const relativeTarget = toPosix(path.relative(decisionsDirectory, resolvedTarget));
  if (!isDecisionRelativePath(relativeTarget)) {
    errors.push(
      relativeSourcePath + " decision link has an invalid target path: " + rawTarget
    );
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
  const lines = relationSection.split("\n").map((value) => value.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^- ([^:]+):\s*(.*?)\s*$/);
    const label = match?.[1].trim();
    if (!match || !label || !isDecisionRelationType(label)) {
      errors.push(relativePath + " has unsupported relationship entry: " + line);
      continue;
    }

    const links = extractMarkdownLinks(match[2]).targets.filter(
      (target) => target.kind === "link"
    );
    if (links.length === 0) {
      errors.push(
        relativePath + " relationship " + label
        + " must use an inline Markdown decision link"
      );
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
      relations.push({ type: label, target });
    }
  }

  return relations;
}

export async function validateDecisionBody(options: {
  body: string;
  decisionPath: string;
  decisionsDirectory: string;
  errors: string[];
  fileName: string;
  relativePath: string;
}): Promise<DecisionDocument | null> {
  const {
    body: rawBody,
    decisionPath,
    decisionsDirectory,
    fileName,
    relativePath,
    errors
  } = options;
  const errorCountBeforeValidation = errors.length;
  const parsedMarkdown = parseDecisionMarkdown({
    errors,
    markdown: rawBody,
    relativePath
  });
  const body = parsedMarkdown?.body ?? "";
  const metadata = parsedMarkdown
    ? decisionMetadataFromCandidate(parsedMarkdown.metadata)
    : null;
  const expectedTitlePrefix = "# ";
  const firstLine = body.split("\n", 1)[0];
  const title = firstLine.startsWith(expectedTitlePrefix)
    ? firstLine.slice(expectedTitlePrefix.length).trim()
    : "";

  if (!isDecisionFileName(fileName)) {
    errors.push(relativePath + " must use semantic file name format short-title.md");
  }
  if (title.length === 0) {
    errors.push(relativePath + " must start with \"" + expectedTitlePrefix + "<标题>\"");
  } else {
    const titleIssue = projectionTextIssue(title);
    if (titleIssue) {
      errors.push(relativePath + " title " + titleIssue);
    }
    if (/^\d{4}-\d{2}-\d{2}\s+-\s+/.test(title)) {
      errors.push(relativePath + " semantic decision title must not include a date prefix");
    }
  }

  const sections = parseSections(body);
  const sectionMap = new Map<string, MarkdownSection[]>();
  const expectedSections = new Set(sectionOrder);

  for (const section of sections) {
    if (!expectedSections.has(section.heading)) {
      errors.push(relativePath + " has unsupported section " + section.heading);
      continue;
    }
    sectionMap.set(section.heading, [
      ...sectionMap.get(section.heading) ?? [],
      section
    ]);
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
  let purpose = "";
  const summarySection = sectionMap.get("## 索引摘要")?.[0]?.content;
  if (summarySection) {
    requireOnlyFields(
      relativePath,
      summarySection,
      "## 索引摘要",
      ["目的", "背景", "决策"],
      errors
    );
    purpose = requireSingleField(relativePath, summarySection, "目的", errors) ?? "";
    background = requireSingleField(relativePath, summarySection, "背景", errors) ?? "";
    decision = requireSingleField(relativePath, summarySection, "决策", errors) ?? "";
    for (const [field, value] of [
      ["purpose", purpose],
      ["background", background],
      ["decision", decision]
    ] as const) {
      if (value.length === 0) {
        continue;
      }
      const issue = projectionTextIssue(value);
      if (issue) {
        errors.push(relativePath + " " + field + " projection " + issue);
      }
    }
  }

  const decisionSection = sectionMap.get("## 决策")?.[0]?.content;
  if (decisionSection) {
    requireNonEmptyField(relativePath, decisionSection, "采用", errors);
  }

  const relationSection = sectionMap.get("## 关系")?.[0]?.content;
  const relations = relationSection
    ? await validateDecisionRelations({
        decisionPath,
        decisionsDirectory,
        errors,
        relationSection,
        relativePath
      })
    : [];

  if (!metadata || errors.length > errorCountBeforeValidation) {
    return null;
  }

  const projection = {
    background,
    decision,
    purpose,
    relations,
    title
  };
  return { ...projection, ...metadata };
}
