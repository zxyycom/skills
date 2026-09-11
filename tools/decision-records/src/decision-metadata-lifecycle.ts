import { isDecisionTimestamp } from "./decision-timestamp.ts";
import {
  decisionAlignments,
  decisionStatuses,
  type DecisionAlignment,
  type DecisionStatus
} from "./types.ts";
import type { DecisionSourceMetadata } from "./decision-metadata-types.ts";

const statusSet: ReadonlySet<unknown> = new Set(decisionStatuses);
const alignmentSet: ReadonlySet<unknown> = new Set(decisionAlignments);

export function parseLifecycleMetadata(options: {
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
  const issues = lifecycleStatusIssues(options);
  options.errors.push(
    ...issues.map((issue) => options.relativePath + " " + issue)
  );
  return issues.length === 0;
}

function lifecycleStatusIssues(options: {
  alignment: unknown;
  createdAt: unknown;
  status: unknown;
}): string[] {
  return options.status === "candidate"
    ? candidateLifecycleIssues(options)
    : establishedLifecycleIssues(options);
}

function candidateLifecycleIssues(options: {
  alignment: unknown;
  createdAt: unknown;
}): string[] {
  const issues: string[] = [];
  if (options.alignment !== null) {
    issues.push("candidate decision frontmatter alignment must be null");
  }
  if (options.createdAt !== null) {
    issues.push("candidate decision frontmatter createdAt must be null");
  }
  return issues;
}

function establishedLifecycleIssues(options: {
  alignment: unknown;
  createdAt: unknown;
  status: unknown;
}): string[] {
  if (options.status !== "active" && options.status !== "archived") return [];
  const issues: string[] = [];
  if (!isDecisionAlignment(options.alignment)) {
    issues.push(
      options.status +
        " decision frontmatter alignment must be aligned or unaligned"
    );
  }
  if (options.createdAt === null) {
    issues.push(
      options.status === "active"
        ? "active decision frontmatter createdAt must not be null; use status: candidate with alignment: null and createdAt: null for a candidate scaffold"
        : "archived decision frontmatter createdAt must not be null"
    );
  }
  return issues;
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
  return isDecisionAlignment(alignment) &&
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
