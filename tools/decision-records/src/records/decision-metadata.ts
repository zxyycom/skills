import { stringify as stringifyYaml } from "yaml";
import {
  parseYamlFrontmatter,
  type Frontmatter
} from "../../../shared/src/markdown/frontmatter.ts";
import { isDecisionId, isDecisionTag } from "../collection/decision-path.ts";
import { projectionTextIssue } from "../index/projection.ts";
import {
  type DecisionId,
  type DecisionMetadata,
  type DecisionProjection,
  type DecisionRelation,
  type DecisionTag
} from "../types.ts";
import { parseLifecycleMetadata } from "./decision-metadata-lifecycle.ts";
import { parseRelations } from "./decision-metadata-relations.ts";
import type {
  DecisionSourceMetadata,
  ParsedDecisionFields,
  ParsedDecisionMarkdown
} from "./decision-metadata-types.ts";
export type {
  DecisionSourceMetadata,
  ParsedDecisionMarkdown
} from "./decision-metadata-types.ts";

const frontmatterPattern = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const frontmatterKeys = [
  "title",
  "id",
  "status",
  "alignment",
  "createdAt",
  "purpose",
  "background",
  "decision",
  "tags",
  "relations"
] as const;
const frontmatterKeySet: ReadonlySet<string> = new Set(frontmatterKeys);

/** 将同次采集的原始文本、身份与字段解析保存在同一只读来源中。 */
export class DecisionMarkdownSource {
  readonly #text: string;
  readonly #markdown: string;
  readonly #frontmatter: Readonly<Frontmatter> | null;

  constructor(markdown: string) {
    this.#text = markdown;
    this.#markdown = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    this.#frontmatter = parseYamlFrontmatter(this.#markdown);
  }

  get text(): string {
    return this.#text;
  }

  identity(): Readonly<{
    decisionId: DecisionId | null;
    isCandidate: boolean;
  }> {
    const frontmatter = this.#frontmatter;
    if (frontmatter === null || frontmatter.error !== null) {
      return { decisionId: null, isCandidate: false };
    }
    return {
      decisionId: isDecisionId(frontmatter.values.id)
        ? frontmatter.values.id
        : null,
      isCandidate: frontmatter.values.status === "candidate"
    };
  }

  parse(
    options: Readonly<{
      errors: string[];
      relativePath: string;
    }>
  ): ParsedDecisionMarkdown | null {
    const { errors, relativePath } = options;
    const markdown = this.#markdown;
    const frontmatterMatch = markdown.match(frontmatterPattern);
    const frontmatter = this.#frontmatter;
    if (!frontmatterMatch || frontmatter === null) {
      errors.push(relativePath + " must start with YAML frontmatter");
      return null;
    }
    if (frontmatter.error !== null) {
      errors.push(relativePath + " frontmatter " + frontmatter.error);
      return null;
    }

    validateFrontmatterKeys(frontmatter.keys, relativePath, errors);
    const fields = parseDecisionFields(
      frontmatter.values,
      relativePath,
      errors
    );
    if (fields === null) return null;
    return {
      body: markdown.slice(frontmatterMatch[0].length).replace(/^\n+/, ""),
      ...fields
    };
  }
}

export function parseDecisionMarkdown(options: {
  errors: string[];
  markdown: string;
  relativePath: string;
}): ParsedDecisionMarkdown | null {
  return new DecisionMarkdownSource(options.markdown).parse(options);
}

/** Reads only the declared identity for source discovery before full validation. */
export function decisionIdFromMarkdown(markdown: string): DecisionId | null {
  return decisionSourceIdentityFromMarkdown(markdown).decisionId;
}

/** Reads discovery identity and candidate status from the same source bytes. */
export function decisionSourceIdentityFromMarkdown(markdown: string): Readonly<{
  decisionId: DecisionId | null;
  isCandidate: boolean;
}> {
  return new DecisionMarkdownSource(markdown).identity();
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

function sameFieldOrder(
  actual: readonly string[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function parseDecisionFields(
  values: Readonly<Record<string, unknown>>,
  relativePath: string,
  errors: string[]
): ParsedDecisionFields | null {
  const id = decisionIdField(values.id, relativePath, errors);
  const projection = parseProjectionFields(values, relativePath, errors);
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
    id === null ||
    projection === null ||
    tags === null ||
    relations === null ||
    metadata === null
  )
    return null;
  return {
    id,
    metadata,
    projection: { ...projection, relations },
    tags
  };
}

function parseProjectionFields(
  values: Readonly<Record<string, unknown>>,
  relativePath: string,
  errors: string[]
): Omit<DecisionProjection, "relations"> | null {
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
  if (
    title === null ||
    purpose === null ||
    background === null ||
    decision === null
  )
    return null;
  return { background, decision, purpose, title };
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
          relations: options.relations.map((relation) => ({ ...relation }))
        };
  return (
    serializeDecisionFrontmatter(
      parsed.id,
      projection,
      parsed.tags,
      options.metadata
    ) + parsed.body
  );
}

export function serializeDecisionFrontmatter(
  decisionId: DecisionId,
  projection: DecisionProjection,
  tags: readonly DecisionTag[],
  metadata: DecisionSourceMetadata
): string {
  const frontmatter = {
    title: projection.title,
    id: decisionId,
    status: metadata.status,
    alignment: metadata.alignment,
    createdAt: metadata.createdAt,
    purpose: projection.purpose,
    background: projection.background,
    decision: projection.decision,
    tags: [...tags],
    relations: projection.relations.map((relation) => ({ ...relation }))
  };
  return [
    "---",
    stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd(),
    "---",
    "",
    ""
  ].join("\n");
}

function decisionIdField(
  value: unknown,
  relativePath: string,
  errors: string[]
): DecisionId | null {
  if (!isDecisionId(value)) {
    errors.push(relativePath + " frontmatter id must be a pure Decision ID");
    return null;
  }
  return value;
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
