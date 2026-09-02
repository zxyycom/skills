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

type ParsedDecisionFields = Omit<ParsedDecisionMarkdown, "body">;

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

  validateFrontmatterKeys(frontmatter.keys, relativePath, errors);
  const fields = parseDecisionFields(frontmatter.values, relativePath, errors);
  if (fields === null) {
    return null;
  }

  return {
    body: markdown.slice(frontmatterMatch[0].length).replace(/^\n+/, ""),
    ...fields
  };
}

function validateFrontmatterKeys(
  keys: readonly string[],
  relativePath: string,
  errors: string[]
): void {
  const unsupportedKeys = keys.filter((key) => !frontmatterKeySet.has(key));
  if (unsupportedKeys.length > 0) {
    errors.push(
      relativePath +
        " frontmatter has unsupported keys: " +
        unsupportedKeys.join(", ")
    );
  }
  for (const key of frontmatterKeys) {
    if (!keys.includes(key)) {
      errors.push(relativePath + " frontmatter is missing " + key);
    }
  }
  if (!sameFieldOrder(keys, frontmatterKeys)) {
    errors.push(
      relativePath +
        " frontmatter fields must use order: " +
        frontmatterKeys.join(", ")
    );
  }
}

function parseDecisionFields(
  values: Readonly<Record<string, unknown>>,
  relativePath: string,
  errors: string[]
): ParsedDecisionFields | null {
  const title = projectionField(values.title, "title", relativePath, errors);
  const purpose = projectionField(
    values.purpose,
    "purpose",
    relativePath,
    errors
  );
  const background = projectionField(
    values.background,
    "background",
    relativePath,
    errors
  );
  const decision = projectionField(
    values.decision,
    "decision",
    relativePath,
    errors
  );
  const tags = parseTags(values.tags, relativePath, errors);
  const relations = parseRelations(values.relations, relativePath, errors);
  const metadata = parseLifecycleMetadata({
    alignment: values.alignment,
    createdAt: values.createdAt,
    errors,
    relativePath,
    status: values.status
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
    metadata,
    projection: { background, decision, purpose, relations, title },
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
  const { alignment, createdAt, status } = options;
  const fieldsValid = validateLifecycleFields(options);
  const statusValid = validateLifecycleStatus(options);
  if (!fieldsValid || !statusValid) {
    return null;
  }

  return decisionSourceMetadata(status, alignment, createdAt);
}

function validateLifecycleFields(options: {
  alignment: unknown;
  createdAt: unknown;
  errors: string[];
  relativePath: string;
  status: unknown;
}): boolean {
  const { alignment, createdAt, errors, relativePath, status } = options;
  const checks = [
    {
      issue: "status must be candidate, active, or archived",
      valid: isDecisionStatus(status)
    },
    {
      issue: "alignment must be aligned, unaligned, or null",
      valid: alignment === null || isDecisionAlignment(alignment)
    },
    {
      issue:
        "createdAt must be an RFC 3339 timestamp precise to seconds with an explicit timezone",
      valid:
        createdAt === null ||
        (typeof createdAt === "string" && isDecisionTimestamp(createdAt))
    }
  ];
  for (const check of checks) {
    if (!check.valid) {
      errors.push(relativePath + " frontmatter " + check.issue);
    }
  }
  return checks.every((check) => check.valid);
}

function validateLifecycleStatus(options: {
  alignment: unknown;
  createdAt: unknown;
  errors: string[];
  relativePath: string;
  status: unknown;
}): boolean {
  const { alignment, createdAt, errors, relativePath, status } = options;
  const issues: string[] = [];
  if (status === "candidate" && alignment !== null) {
    issues.push("candidate decision frontmatter alignment must be null");
  }
  if (status === "candidate" && createdAt !== null) {
    issues.push("candidate decision frontmatter createdAt must be null");
  }
  if (status === "active" && !isDecisionAlignment(alignment)) {
    issues.push(
      "active decision frontmatter alignment must be aligned or unaligned"
    );
  }
  if (status === "active" && createdAt === null) {
    issues.push(
      "active decision frontmatter createdAt must not be null; use status: " +
        "candidate with alignment: null and createdAt: null for a candidate scaffold"
    );
  }
  if (status === "archived" && createdAt === null) {
    issues.push("archived decision frontmatter createdAt must not be null");
  }
  errors.push(...issues.map((issue) => relativePath + " " + issue));
  return issues.length === 0;
}

function decisionSourceMetadata(
  status: unknown,
  alignment: unknown,
  createdAt: unknown
): DecisionSourceMetadata | null {
  switch (status) {
    case "candidate":
      return candidateSourceMetadata(alignment, createdAt);
    case "active":
      return activeSourceMetadata(alignment, createdAt);
    case "archived":
      return archivedSourceMetadata(alignment, createdAt);
    default:
      return null;
  }
}

function candidateSourceMetadata(
  alignment: unknown,
  createdAt: unknown
): DecisionSourceMetadata | null {
  return alignment === null && createdAt === null
    ? { alignment, createdAt, status: "candidate" }
    : null;
}

function activeSourceMetadata(
  alignment: unknown,
  createdAt: unknown
): DecisionSourceMetadata | null {
  return isDecisionAlignment(alignment) &&
    typeof createdAt === "string" &&
    isDecisionTimestamp(createdAt)
    ? { alignment, createdAt, status: "active" }
    : null;
}

function archivedSourceMetadata(
  alignment: unknown,
  createdAt: unknown
): DecisionSourceMetadata | null {
  return (alignment === null || isDecisionAlignment(alignment)) &&
    typeof createdAt === "string" &&
    isDecisionTimestamp(createdAt)
    ? { alignment, createdAt, status: "archived" }
    : null;
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
