import { parseSections, requireNonEmptyField } from "./markdown.ts";
import {
  parseDecisionMarkdown,
  type DecisionSourceMetadata
} from "./decision-metadata.ts";
import { isDecisionId } from "./decision-path.ts";
import {
  type DecisionProjection,
  type DecisionId,
  type DecisionRelation,
  type DecisionTags,
  type MarkdownSection
} from "./types.ts";

export type ValidatedDecisionBody = DecisionProjection &
  DecisionTags &
  DecisionSourceMetadata & {
    body: string;
    bodyReady: boolean;
  };

const sectionOrder = ["## 目的", "## 背景", "## 决策"];
const requiredSections = new Set(sectionOrder);

type DecisionRelationTargetExists = (
  decisionId: DecisionId
) => boolean | Promise<boolean>;

async function validateDecisionRelations(options: {
  decisionId: string;
  errors: string[];
  relations: readonly DecisionRelation[];
  sourcePath: string;
  targetExists: DecisionRelationTargetExists;
}): Promise<void> {
  const { decisionId, errors, relations, sourcePath, targetExists } = options;

  for (const relation of relations) {
    if (relation.target === decisionId) {
      errors.push(sourcePath + " must not relate to itself");
      continue;
    }
    if (!(await targetExists(relation.target))) {
      errors.push(
        sourcePath +
          " relationship " +
          relation.type +
          " target does not exist: " +
          relation.target
      );
    }
  }
}

export async function validateDecisionBody(options: {
  body: string;
  decisionId: string;
  errors: string[];
  sourcePath: string;
  targetExists: DecisionRelationTargetExists;
}): Promise<ValidatedDecisionBody | null> {
  const { body: rawBody, decisionId, sourcePath, errors } = options;
  const errorCountBeforeValidation = errors.length;
  const parsedMarkdown = parseDecisionMarkdown({
    errors,
    markdown: rawBody,
    relativePath: sourcePath
  });
  const body = parsedMarkdown?.body ?? "";
  const metadata = parsedMarkdown?.metadata ?? null;
  const projection = parsedMarkdown?.projection ?? null;

  if (!isDecisionId(decisionId)) {
    errors.push(
      sourcePath + " must use a stable kebab-case Decision ID basename"
    );
  }
  if (!body.startsWith("## 目的\n")) {
    errors.push(sourcePath + ' body must start with "## 目的"');
  }

  const sections = parseSections(body);
  const sectionMap = new Map<string, MarkdownSection[]>();
  for (const section of sections) {
    if (!requiredSections.has(section.heading)) {
      errors.push(sourcePath + " has unsupported section " + section.heading);
      continue;
    }
    sectionMap.set(section.heading, [
      ...(sectionMap.get(section.heading) ?? []),
      section
    ]);
  }

  for (const sectionHeading of requiredSections) {
    if (!sectionMap.has(sectionHeading)) {
      errors.push(sourcePath + " is missing section " + sectionHeading);
    }
  }

  for (const [sectionHeading, entries] of sectionMap) {
    if (entries.length > 1) {
      errors.push(
        sourcePath + " contains section " + sectionHeading + " more than once"
      );
    }
    for (const entry of entries) {
      if (entry.content.length === 0 && metadata?.status !== "candidate") {
        errors.push(
          sourcePath + " section " + sectionHeading + " must not be empty"
        );
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
      errors.push(sourcePath + " has sections out of order");
      break;
    }
    previousOrder = currentOrder;
  }

  const decisionSection = sectionMap.get("## 决策")?.[0]?.content;
  const decisionFieldErrors: string[] = [];
  if (decisionSection) {
    requireNonEmptyField(
      sourcePath,
      decisionSection,
      "采用",
      decisionFieldErrors
    );
  }
  if (metadata?.status !== "candidate") {
    errors.push(...decisionFieldErrors);
  }
  const bodyReady =
    sectionOrder.every((sectionHeading) => {
      const entries = sectionMap.get(sectionHeading);
      return entries?.length === 1 && entries[0]?.content.length > 0;
    }) && decisionFieldErrors.length === 0;

  if (projection) {
    await validateDecisionRelations({
      errors,
      relations: projection.relations,
      decisionId,
      sourcePath,
      targetExists: options.targetExists
    });
  }

  if (
    parsedMarkdown === null ||
    metadata === null ||
    projection === null ||
    errors.length > errorCountBeforeValidation
  ) {
    return null;
  }

  return {
    ...projection,
    tags: [...parsedMarkdown.tags],
    ...metadata,
    body,
    bodyReady
  };
}
