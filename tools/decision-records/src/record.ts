import path from "node:path";
import { pathExists } from "../../shared/src/node/filesystem.ts";
import {
  parseSections,
  requireNonEmptyField
} from "./markdown.ts";
import {
  parseDecisionMarkdown,
  type DecisionMetadataCandidate
} from "./decision-metadata.ts";
import { isDecisionFileName } from "./decision-path.ts";
import {
  type DecisionProjection,
  type DecisionRelation,
  type MarkdownSection
} from "./types.ts";

export type ValidatedDecisionBody = DecisionProjection & DecisionMetadataCandidate;

const sectionOrder = [
  "## 目的",
  "## 背景",
  "## 决策"
];
const requiredSections = new Set(sectionOrder);

async function validateDecisionRelations(options: {
  decisionsDirectory: string;
  errors: string[];
  relations: readonly DecisionRelation[];
  relativePath: string;
}): Promise<void> {
  const {
    decisionsDirectory,
    errors,
    relations,
    relativePath
  } = options;

  for (const relation of relations) {
    if (relation.target === relativePath) {
      errors.push(relativePath + " must not relate to itself");
      continue;
    }
    const resolvedTarget = path.join(
      decisionsDirectory,
      ...relation.target.split("/")
    );
    if (!await pathExists(resolvedTarget)) {
      errors.push(
        relativePath
        + " relationship "
        + relation.type
        + " target does not exist: "
        + relation.target
      );
    }
  }
}

export async function validateDecisionBody(options: {
  allowNullCreatedAt?: boolean;
  body: string;
  decisionsDirectory: string;
  errors: string[];
  fileName: string;
  relativePath: string;
}): Promise<ValidatedDecisionBody | null> {
  const {
    allowNullCreatedAt = false,
    body: rawBody,
    decisionsDirectory,
    fileName,
    relativePath,
    errors
  } = options;
  const errorCountBeforeValidation = errors.length;
  const parsedMarkdown = parseDecisionMarkdown({
    allowNullCreatedAt,
    errors,
    markdown: rawBody,
    relativePath
  });
  const body = parsedMarkdown?.body ?? "";
  const metadata = parsedMarkdown?.metadata ?? null;
  const projection = parsedMarkdown?.projection ?? null;

  if (!isDecisionFileName(fileName)) {
    errors.push(relativePath + " must use semantic file name format short-title.md");
  }
  if (projection && /^\d{4}-\d{2}-\d{2}\s+-\s+/.test(projection.title)) {
    errors.push(relativePath + " semantic decision title must not include a date prefix");
  }
  if (!body.startsWith("## 目的\n")) {
    errors.push(relativePath + " body must start with \"## 目的\"");
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

  const decisionSection = sectionMap.get("## 决策")?.[0]?.content;
  if (decisionSection) {
    requireNonEmptyField(relativePath, decisionSection, "采用", errors);
  }

  if (projection) {
    await validateDecisionRelations({
      decisionsDirectory,
      errors,
      relations: projection.relations,
      relativePath
    });
  }

  if (!metadata || !projection || errors.length > errorCountBeforeValidation) {
    return null;
  }

  return {
    title: projection.title,
    purpose: projection.purpose,
    background: projection.background,
    decision: projection.decision,
    relations: projection.relations,
    status: metadata.status,
    alignment: metadata.alignment,
    createdAt: metadata.createdAt
  };
}
