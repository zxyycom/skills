import { parseYamlFrontmatter } from "../../lib/frontmatter.ts";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import {
  decisionAlignments,
  decisionStatuses,
  type DecisionAlignment,
  type DecisionMetadata,
  type DecisionStatus
} from "./types.ts";

const frontmatterPattern = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const metadataKeys = ["status", "alignment", "createdAt"] as const;
const statusSet: ReadonlySet<unknown> = new Set(decisionStatuses);
const alignmentSet: ReadonlySet<unknown> = new Set(decisionAlignments);

export type DecisionMetadataCandidate = {
  alignment: DecisionAlignment | null;
  createdAt: string | null;
  status: DecisionStatus;
};

export type ParsedDecisionMarkdown = {
  body: string;
  metadata: DecisionMetadataCandidate;
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
    (key) => !metadataKeys.includes(key as typeof metadataKeys[number])
  );
  if (unsupportedKeys.length > 0) {
    errors.push(
      relativePath
      + " frontmatter has unsupported keys: "
      + unsupportedKeys.join(", ")
    );
  }
  for (const key of metadataKeys) {
    if (!frontmatter.keys.includes(key)) {
      errors.push(relativePath + " frontmatter is missing " + key);
    }
  }

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

  if (!statusSet.has(status)
    || (alignment !== null && !alignmentSet.has(alignment))
    || (createdAt !== null && typeof createdAt !== "string")
    || (createdAt === null && !allowNullCreatedAt)) {
    return null;
  }

  return {
    body: markdown.slice(frontmatterMatch[0].length).replace(/^\n+/, ""),
    metadata: {
      alignment: alignment as DecisionAlignment | null,
      createdAt,
      status: status as DecisionStatus
    }
  };
}

export function decisionMetadataFromCandidate(
  candidate: DecisionMetadataCandidate
): DecisionMetadata | null {
  if (candidate.createdAt === null) {
    return null;
  }
  if (candidate.status === "active"
    && candidate.alignment !== null) {
    return {
      alignment: candidate.alignment,
      createdAt: candidate.createdAt,
      status: "active"
    };
  }
  if (candidate.status === "archived"
    && candidate.alignment === null) {
    return {
      alignment: null,
      createdAt: candidate.createdAt,
      status: "archived"
    };
  }
  return null;
}

export function replaceDecisionMetadata(
  markdown: string,
  metadata: DecisionMetadataCandidate
): string | null {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(frontmatterPattern);
  if (!match) {
    return null;
  }

  const frontmatter = [
    "---",
    "status: " + metadata.status,
    "alignment: " + (metadata.alignment ?? "null"),
    "createdAt: " + (metadata.createdAt ?? "null"),
    "---",
    "",
    ""
  ].join("\n");
  return frontmatter + normalized.slice(match[0].length).replace(/^\n+/, "");
}
