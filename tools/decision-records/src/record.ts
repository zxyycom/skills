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

type DecisionSectionValidation = Readonly<{
  bodyReady: boolean;
  sectionMap: Map<string, MarkdownSection[]>;
}>;

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

  if (!isDecisionId(decisionId)) {
    errors.push(
      sourcePath + " must use a stable kebab-case Decision ID basename"
    );
  }
  if (!body.startsWith("## 目的\n")) {
    errors.push(sourcePath + ' body must start with "## 目的"');
  }

  const sections = validateDecisionSections(
    body,
    sourcePath,
    parsedMarkdown?.metadata ?? null,
    errors
  );

  if (parsedMarkdown !== null) {
    await validateDecisionRelations({
      errors,
      relations: parsedMarkdown.projection.relations,
      decisionId,
      sourcePath,
      targetExists: options.targetExists
    });
  }
  return validatedDecisionBody(
    parsedMarkdown,
    body,
    sections.bodyReady,
    errors.length === errorCountBeforeValidation
  );
}

function validatedDecisionBody(
  parsedMarkdown: ReturnType<typeof parseDecisionMarkdown>,
  body: string,
  bodyReady: boolean,
  valid: boolean
): ValidatedDecisionBody | null {
  if (parsedMarkdown === null || !valid) return null;
  return {
    ...parsedMarkdown.projection,
    tags: [...parsedMarkdown.tags],
    ...parsedMarkdown.metadata,
    body,
    bodyReady
  };
}

function validateDecisionSections(
  body: string,
  sourcePath: string,
  metadata: DecisionSourceMetadata | null,
  errors: string[]
): DecisionSectionValidation {
  const sections = parseSections(body);
  const sectionMap = groupDecisionSections(sections, sourcePath, errors);
  validateRequiredSections(sectionMap, sourcePath, errors);
  validateSectionContents(sectionMap, sourcePath, metadata, errors);
  validateSectionOrder(sections, sourcePath, errors);

  const decisionFieldErrors: string[] = [];
  const decisionSection = sectionMap.get("## 决策")?.[0]?.content;
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
  return {
    bodyReady:
      sectionOrder.every((heading) => {
        const entries = sectionMap.get(heading);
        return entries?.length === 1 && entries[0]?.content.length > 0;
      }) && decisionFieldErrors.length === 0,
    sectionMap
  };
}

function groupDecisionSections(
  sections: readonly MarkdownSection[],
  sourcePath: string,
  errors: string[]
): Map<string, MarkdownSection[]> {
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
  return sectionMap;
}

function validateRequiredSections(
  sectionMap: ReadonlyMap<string, readonly MarkdownSection[]>,
  sourcePath: string,
  errors: string[]
): void {
  for (const heading of requiredSections) {
    if (!sectionMap.has(heading)) {
      errors.push(sourcePath + " is missing section " + heading);
    }
  }
}

function validateSectionContents(
  sectionMap: ReadonlyMap<string, readonly MarkdownSection[]>,
  sourcePath: string,
  metadata: DecisionSourceMetadata | null,
  errors: string[]
): void {
  for (const [heading, entries] of sectionMap) {
    if (entries.length > 1) {
      errors.push(
        sourcePath + " contains section " + heading + " more than once"
      );
    }
    for (const entry of entries) {
      if (entry.content.length === 0 && metadata?.status !== "candidate") {
        errors.push(sourcePath + " section " + heading + " must not be empty");
      }
    }
  }
}

function validateSectionOrder(
  sections: readonly MarkdownSection[],
  sourcePath: string,
  errors: string[]
): void {
  let previousOrder = -1;
  for (const section of sections) {
    const currentOrder = sectionOrder.indexOf(section.heading);
    if (currentOrder < 0) continue;
    if (currentOrder < previousOrder) {
      errors.push(sourcePath + " has sections out of order");
      return;
    }
    previousOrder = currentOrder;
  }
}
