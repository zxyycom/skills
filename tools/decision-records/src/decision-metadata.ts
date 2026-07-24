import { stringify as stringifyYaml } from "yaml";
import { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";
import { isDecisionRelativePath } from "./decision-path.ts";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import { projectionTextIssue } from "./projection.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  decisionStatuses,
  type DecisionAlignment,
  type DecisionMetadata,
  type DecisionProjection,
  type DecisionRelation,
  type DecisionRelationType,
  type DecisionStatus
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
  "relations"
] as const;
const relationKeys = ["type", "target"] as const;
const statusSet: ReadonlySet<unknown> = new Set(decisionStatuses);
const alignmentSet: ReadonlySet<unknown> = new Set(decisionAlignments);
const relationTypeSet: ReadonlySet<unknown> = new Set(decisionRelationTypes);

export type DecisionMetadataCandidate = {
  status: DecisionStatus;
  alignment: DecisionAlignment | null;
  createdAt: string | null;
};

export type ParsedDecisionMarkdown = {
  body: string;
  metadata: DecisionMetadataCandidate;
  projection: DecisionProjection;
};

export function parseDecisionMarkdown(options: {
  allowNullCreatedAt?: boolean;
  errors: string[];
  markdown: string;
  relativePath: string;
}): ParsedDecisionMarkdown | null {
  const {
    allowNullCreatedAt = false,
    errors,
    markdown: rawMarkdown,
    relativePath
  } = options;
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
    (key) => !frontmatterKeys.includes(key as typeof frontmatterKeys[number])
  );
  if (unsupportedKeys.length > 0) {
    errors.push(
      relativePath
      + " frontmatter has unsupported keys: "
      + unsupportedKeys.join(", ")
    );
  }
  for (const key of frontmatterKeys) {
    if (!frontmatter.keys.includes(key)) {
      errors.push(relativePath + " frontmatter is missing " + key);
    }
  }
  if (!sameFieldOrder(frontmatter.keys, frontmatterKeys)) {
    errors.push(
      relativePath
      + " frontmatter fields must use order: "
      + frontmatterKeys.join(", ")
    );
  }

  const title = projectionField(frontmatter.values.title, "title", relativePath, errors);
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
  const relations = parseRelations(frontmatter.values.relations, relativePath, errors);
  const status = frontmatter.values.status;
  const alignment = frontmatter.values.alignment;
  const createdAt = frontmatter.values.createdAt;

  if (!statusSet.has(status)) {
    errors.push(relativePath + " frontmatter status must be active or archived");
  }
  if (alignment !== null && !alignmentSet.has(alignment)) {
    errors.push(
      relativePath + " frontmatter alignment must be aligned, unaligned, or null"
    );
  }
  if (createdAt === null) {
    if (!allowNullCreatedAt) {
      errors.push(relativePath + " frontmatter createdAt must not be null");
    }
  } else if (typeof createdAt !== "string" || !isDecisionTimestamp(createdAt)) {
    errors.push(
      relativePath
      + " frontmatter createdAt must be an RFC 3339 timestamp precise to seconds "
      + "with an explicit timezone"
    );
  }

  if (status === "active" && !alignmentSet.has(alignment)) {
    errors.push(
      relativePath + " active decision frontmatter alignment must be aligned or unaligned"
    );
  }
  if (status === "archived" && alignment !== null) {
    errors.push(relativePath + " archived decision frontmatter alignment must be null");
  }

  if (
    title === null
    || purpose === null
    || background === null
    || decision === null
    || relations === null
    || !statusSet.has(status)
    || (alignment !== null && !alignmentSet.has(alignment))
    || (createdAt !== null && typeof createdAt !== "string")
    || (createdAt === null && !allowNullCreatedAt)
  ) {
    return null;
  }

  return {
    body: markdown.slice(frontmatterMatch[0].length).replace(/^\n+/, ""),
    metadata: {
      status: status as DecisionStatus,
      alignment: alignment as DecisionAlignment | null,
      createdAt
    },
    projection: {
      title,
      purpose,
      background,
      decision,
      relations
    }
  };
}

export function decisionMetadataFromCandidate(
  candidate: DecisionMetadataCandidate
): DecisionMetadata | null {
  if (candidate.createdAt === null) {
    return null;
  }
  if (candidate.status === "active" && candidate.alignment !== null) {
    return {
      status: "active",
      alignment: candidate.alignment,
      createdAt: candidate.createdAt
    };
  }
  if (candidate.status === "archived" && candidate.alignment === null) {
    return {
      status: "archived",
      alignment: null,
      createdAt: candidate.createdAt
    };
  }
  return null;
}

export function replaceDecisionMetadata(
  markdown: string,
  metadata: DecisionMetadataCandidate
): string | null {
  const errors: string[] = [];
  const parsed = parseDecisionMarkdown({
    allowNullCreatedAt: true,
    errors,
    markdown,
    relativePath: "<decision>"
  });
  if (parsed === null || errors.length > 0) {
    return null;
  }
  return serializeDecisionFrontmatter(parsed.projection, metadata) + parsed.body;
}

export function serializeDecisionFrontmatter(
  projection: DecisionProjection,
  metadata: DecisionMetadataCandidate
): string {
  const frontmatter = {
    title: projection.title,
    status: metadata.status,
    alignment: metadata.alignment,
    createdAt: metadata.createdAt,
    purpose: projection.purpose,
    background: projection.background,
    decision: projection.decision,
    relations: projection.relations.map(({ type, target }) => ({ type, target }))
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
  const seen = new Set<string>();
  let valid = true;
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate)) {
      errors.push(relativePath + ` frontmatter relations[${index}] must be an object`);
      valid = false;
      continue;
    }
    const keys = Object.keys(candidate);
    if (!sameFieldOrder(keys, relationKeys)) {
      errors.push(
        relativePath
        + ` frontmatter relations[${index}] fields must use order: `
        + relationKeys.join(", ")
      );
      valid = false;
    }
    const type = candidate.type;
    const target = candidate.target;
    if (!relationTypeSet.has(type)) {
      errors.push(
        relativePath
        + ` frontmatter relations[${index}].type must be `
        + decisionRelationTypes.join(", ")
      );
      valid = false;
      continue;
    }
    if (typeof target !== "string" || !isDecisionRelativePath(target)) {
      errors.push(
        relativePath
        + ` frontmatter relations[${index}].target must be a decision-root-relative path`
      );
      valid = false;
      continue;
    }
    const relationKey = `${String(type)}\u0000${target}`;
    if (seen.has(relationKey)) {
      errors.push(
        relativePath + " repeats relationship " + String(type) + " target " + target
      );
      valid = false;
      continue;
    }
    seen.add(relationKey);
    relations.push({ type: type as DecisionRelationType, target });
  }
  return valid ? relations : null;
}

function sameFieldOrder(
  actual: readonly string[],
  expected: readonly string[]
): boolean {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
