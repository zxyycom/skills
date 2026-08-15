import { stringify as stringifyYaml } from "yaml";
import { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";
import { isDecisionId, isDecisionTag } from "./decision-path.ts";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import { projectionTextIssue } from "./projection.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  decisionStatuses,
  type DecisionAlignment,
  type DecisionId,
  type DecisionMetadata,
  type DecisionProjection,
  type DecisionRelation,
  type DecisionRelationType,
  type DecisionStatus,
  type DecisionTag
} from "./types.ts";

const frontmatterPattern = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const frontmatterKeys = [
  "title",
  "status",
  "alignment",
  "createdAt",
  "purpose",
  "background",
  "decision",
  "tags",
  "relations"
] as const;
const relationKeys = ["type", "target"] as const;
const frontmatterKeySet: ReadonlySet<string> = new Set(frontmatterKeys);
const statusSet: ReadonlySet<unknown> = new Set(decisionStatuses);
const alignmentSet: ReadonlySet<unknown> = new Set(decisionAlignments);
const relationTypeSet: ReadonlySet<unknown> = new Set(decisionRelationTypes);

export type DecisionSourceMetadata =
  | DecisionMetadata
  | {
      status: "candidate";
      alignment: null;
      createdAt: null;
    };

export type ParsedDecisionMarkdown = {
  body: string;
  metadata: DecisionSourceMetadata;
  projection: DecisionProjection;
  tags: DecisionTag[];
};

export function parseDecisionMarkdown(options: {
  errors: string[];
  markdown: string;
  relativePath: string;
}): ParsedDecisionMarkdown | null {
  const { errors, markdown: rawMarkdown, relativePath } = options;
  const markdown = rawMarkdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const frontmatterMatch = markdown.match(frontmatterPattern);
  if (!frontmatterMatch) {
    errors.push(relativePath + " must start with YAML frontmatter");
    return null;
  }

  const frontmatter = parseYamlFrontmatter(markdown);
  if (!frontmatter) {
    errors.push(relativePath + " must start with YAML frontmatter");
    return null;
  }
  if (frontmatter.error !== null) {
    errors.push(relativePath + " frontmatter " + frontmatter.error);
    return null;
  }

  const unsupportedKeys = frontmatter.keys.filter(
    (key) => !frontmatterKeySet.has(key)
  );
  if (unsupportedKeys.length > 0) {
    errors.push(
      relativePath +
        " frontmatter has unsupported keys: " +
        unsupportedKeys.join(", ")
    );
  }
  for (const key of frontmatterKeys) {
    if (!frontmatter.keys.includes(key)) {
      errors.push(relativePath + " frontmatter is missing " + key);
    }
  }
  if (!sameFieldOrder(frontmatter.keys, frontmatterKeys)) {
    errors.push(
      relativePath +
        " frontmatter fields must use order: " +
        frontmatterKeys.join(", ")
    );
  }

  const title = projectionField(
    frontmatter.values.title,
    "title",
    relativePath,
    errors
  );
  const purpose = projectionField(
    frontmatter.values.purpose,
    "purpose",
    relativePath,
    errors
  );
  const background = projectionField(
    frontmatter.values.background,
    "background",
    relativePath,
    errors
  );
  const decision = projectionField(
    frontmatter.values.decision,
    "decision",
    relativePath,
    errors
  );
  const tags = parseTags(frontmatter.values.tags, relativePath, errors);
  const relations = parseRelations(
    frontmatter.values.relations,
    relativePath,
    errors
  );
  const metadata = parseLifecycleMetadata({
    alignment: frontmatter.values.alignment,
    createdAt: frontmatter.values.createdAt,
    errors,
    relativePath,
    status: frontmatter.values.status
  });
  if (
    title === null ||
    purpose === null ||
    background === null ||
    decision === null ||
    tags === null ||
    relations === null ||
    metadata === null
  ) {
    return null;
  }

  return {
    body: markdown.slice(frontmatterMatch[0].length).replace(/^\n+/, ""),
    metadata,
    projection: {
      title,
      purpose,
      background,
      decision,
      relations
    },
    tags
  };
}

export function establishedDecisionMetadataFromSource(
  source: DecisionSourceMetadata
): DecisionMetadata | null {
  if (source.status === "candidate") {
    return null;
  }
  return source;
}

export function replaceDecisionFrontmatter(
  markdown: string,
  options: {
    metadata: DecisionSourceMetadata;
    relations?: readonly DecisionRelation[];
  }
): string | null {
  const errors: string[] = [];
  const parsed = parseDecisionMarkdown({
    errors,
    markdown,
    relativePath: "<decision>"
  });
  if (parsed === null || errors.length > 0) {
    return null;
  }
  const projection: DecisionProjection =
    options.relations === undefined
      ? parsed.projection
      : {
          ...parsed.projection,
          relations: options.relations.map(({ type, target }) => ({
            type,
            target
          }))
        };
  return (
    serializeDecisionFrontmatter(projection, parsed.tags, options.metadata) +
    parsed.body
  );
}

export function serializeDecisionFrontmatter(
  projection: DecisionProjection,
  tags: readonly DecisionTag[],
  metadata: DecisionSourceMetadata
): string {
  const frontmatter = {
    title: projection.title,
    status: metadata.status,
    alignment: metadata.alignment,
    createdAt: metadata.createdAt,
    purpose: projection.purpose,
    background: projection.background,
    decision: projection.decision,
    tags: [...tags],
    relations: projection.relations.map(({ type, target }) => ({
      type,
      target
    }))
  };
  return [
    "---",
    stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd(),
    "---",
    "",
    ""
  ].join("\n");
}

function projectionField(
  value: unknown,
  field: "background" | "decision" | "purpose" | "title",
  relativePath: string,
  errors: string[]
): string | null {
  if (typeof value !== "string") {
    errors.push(relativePath + " frontmatter " + field + " must be a string");
    return null;
  }
  const issue = projectionTextIssue(value);
  if (issue !== null) {
    errors.push(relativePath + " " + field + " projection " + issue);
  }
  return value;
}

function parseTags(
  value: unknown,
  relativePath: string,
  errors: string[]
): DecisionTag[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(relativePath + " frontmatter tags must be a non-empty array");
    return null;
  }
  const tags: DecisionTag[] = [];
  const seen = new Set<DecisionTag>();
  let valid = true;
  for (const [index, tag] of value.entries()) {
    if (!isDecisionTag(tag)) {
      errors.push(
        relativePath + ` frontmatter tags[${index}] must be a kebab-case tag`
      );
      valid = false;
      continue;
    }
    if (seen.has(tag)) {
      errors.push(relativePath + " repeats tag " + tag);
      valid = false;
      continue;
    }
    seen.add(tag);
    tags.push(tag);
  }
  if (!usesLexicalAscendingOrder(tags)) {
    errors.push(
      relativePath + " frontmatter tags must use lexical ascending order"
    );
    valid = false;
  }
  return valid ? tags : null;
}

function parseRelations(
  value: unknown,
  relativePath: string,
  errors: string[]
): DecisionRelation[] | null {
  if (!Array.isArray(value)) {
    errors.push(relativePath + " frontmatter relations must be an array");
    return null;
  }

  const relations: DecisionRelation[] = [];
  const seenTargets = new Set<DecisionId>();
  let valid = true;
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate)) {
      errors.push(
        relativePath + ` frontmatter relations[${index}] must be an object`
      );
      valid = false;
      continue;
    }
    const keys = Object.keys(candidate);
    if (!sameFieldOrder(keys, relationKeys)) {
      errors.push(
        relativePath +
          ` frontmatter relations[${index}] fields must use order: ` +
          relationKeys.join(", ")
      );
      valid = false;
    }
    const type = candidate.type;
    const target = candidate.target;
    if (!isDecisionRelationType(type)) {
      errors.push(
        relativePath +
          ` frontmatter relations[${index}].type must be ` +
          decisionRelationTypes.join(", ")
      );
      valid = false;
      continue;
    }
    if (!isDecisionId(target)) {
      errors.push(
        relativePath +
          ` frontmatter relations[${index}].target must be a Decision ID`
      );
      valid = false;
      continue;
    }
    if (seenTargets.has(target)) {
      errors.push(relativePath + " repeats relationship target " + target);
      valid = false;
      continue;
    }
    seenTargets.add(target);
    relations.push({ type, target });
  }
  return valid ? relations : null;
}

function sameFieldOrder(
  actual: readonly string[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLifecycleMetadata(options: {
  alignment: unknown;
  createdAt: unknown;
  errors: string[];
  relativePath: string;
  status: unknown;
}): DecisionSourceMetadata | null {
  const { alignment, createdAt, errors, relativePath, status } = options;
  const statusValid = isDecisionStatus(status);
  const alignmentValid = alignment === null || isDecisionAlignment(alignment);
  const createdAtValid =
    createdAt === null ||
    (typeof createdAt === "string" && isDecisionTimestamp(createdAt));
  let lifecycleValid = statusValid && alignmentValid && createdAtValid;

  if (!statusValid) {
    errors.push(
      relativePath +
        " frontmatter status must be candidate, active, or archived"
    );
  }
  if (!alignmentValid) {
    errors.push(
      relativePath +
        " frontmatter alignment must be aligned, unaligned, or null"
    );
  }
  if (!createdAtValid) {
    errors.push(
      relativePath +
        " frontmatter createdAt must be an RFC 3339 timestamp precise to seconds " +
        "with an explicit timezone"
    );
  }
  if (status === "candidate" && alignment !== null) {
    lifecycleValid = false;
    errors.push(
      relativePath + " candidate decision frontmatter alignment must be null"
    );
  }
  if (status === "candidate" && createdAt !== null) {
    lifecycleValid = false;
    errors.push(
      relativePath + " candidate decision frontmatter createdAt must be null"
    );
  }
  if (status === "active" && !isDecisionAlignment(alignment)) {
    lifecycleValid = false;
    errors.push(
      relativePath +
        " active decision frontmatter alignment must be aligned or unaligned"
    );
  }
  if (status === "active" && createdAt === null) {
    lifecycleValid = false;
    errors.push(
      relativePath +
        " active decision frontmatter createdAt must not be null; use status: " +
        "candidate with alignment: null for a reviewable candidate"
    );
  }
  if (status === "archived" && createdAt === null) {
    lifecycleValid = false;
    errors.push(
      relativePath + " archived decision frontmatter createdAt must not be null"
    );
  }
  if (!lifecycleValid) {
    return null;
  }

  if (status === "candidate" && alignment === null && createdAt === null) {
    return { alignment, createdAt, status };
  }
  if (
    status === "active" &&
    isDecisionAlignment(alignment) &&
    typeof createdAt === "string" &&
    isDecisionTimestamp(createdAt)
  ) {
    return { alignment, createdAt, status };
  }
  if (
    status === "archived" &&
    (alignment === null || isDecisionAlignment(alignment)) &&
    typeof createdAt === "string" &&
    isDecisionTimestamp(createdAt)
  ) {
    return { alignment, createdAt, status };
  }
  return null;
}

function isDecisionStatus(value: unknown): value is DecisionStatus {
  return statusSet.has(value);
}

function isDecisionAlignment(value: unknown): value is DecisionAlignment {
  return alignmentSet.has(value);
}

function isDecisionRelationType(value: unknown): value is DecisionRelationType {
  return relationTypeSet.has(value);
}

function usesLexicalAscendingOrder(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      previous === undefined ||
      current === undefined ||
      previous >= current
    ) {
      return false;
    }
  }
  return true;
}
