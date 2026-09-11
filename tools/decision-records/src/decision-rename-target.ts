import {
  datedDecisionIdForName,
  decisionNameFromId,
  parseDatedDecisionId,
  sourcePathForDecisionRename,
  utcDecisionDate
} from "./decision-path.ts";
import { renameFailure } from "./decision-rename-failure.ts";
import {
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionId,
  type DecisionRecord
} from "./types.ts";
import type { DecisionApplicationFailure } from "./application-result.ts";
import type {
  RenameTarget,
  RenameableDecisionRecord
} from "./decision-rename-planning.ts";

type RenameIdentity = Readonly<{
  decisionId: DecisionId;
  name: string;
}>;

export function resolveRenameTarget(
  source: RenameableDecisionRecord,
  records: readonly DecisionRecord[],
  rawTarget: string
):
  | Readonly<{ status: "ok"; value: RenameTarget }>
  | DecisionApplicationFailure {
  const identity = resolveRenameIdentity(source, rawTarget);
  if ("status" in identity) return identity;
  const conflict = renameIdentityConflict(source, records, identity);
  if (conflict !== null) return conflict;
  return renameTargetLocation(source, records, identity);
}

function resolveRenameIdentity(
  source: RenameableDecisionRecord,
  rawTarget: string
): RenameIdentity | DecisionApplicationFailure {
  const normalized = rawTarget.replace(/\.md$/iu, "");
  const explicit = parseDatedDecisionId(normalized);
  const expectedDate = expectedRenameDate(source);
  const legacyFailure = legacyCandidateDateFailure(
    source,
    explicit,
    normalized
  );
  if (legacyFailure !== null) return legacyFailure;
  const dateFailure = renameDateMismatchFailure(
    explicit,
    expectedDate,
    normalized
  );
  if (dateFailure !== null) return dateFailure;
  const decisionId =
    explicit?.id ?? datedDecisionIdForExpectedDate(normalized, expectedDate);
  return decisionId === null
    ? invalidRenameIdentityFailure(normalized)
    : { decisionId, name: decisionNameFromId(decisionId) };
}

function expectedRenameDate(source: RenameableDecisionRecord): string | null {
  const dated = parseDatedDecisionId(source.decisionId);
  if (dated !== null) return dated.date;
  return source.source.kind === "established" && source.createdAt !== null
    ? utcDecisionDate(new Date(source.createdAt))
    : null;
}

function legacyCandidateDateFailure(
  source: RenameableDecisionRecord,
  explicit: ReturnType<typeof parseDatedDecisionId>,
  normalized: string
): DecisionApplicationFailure | null {
  if (source.source.kind !== "candidate") return null;
  if (parseDatedDecisionId(source.decisionId) !== null || explicit !== null)
    return null;
  return renameFailure(
    "decision-records.rename-date-required",
    "A legacy Decision candidate has no authoritative formation date for a name rename.",
    "Provide a complete calendar-valid YYMMDD-name target ID to explicitly choose the migration date.",
    normalized
  );
}

function renameDateMismatchFailure(
  explicit: ReturnType<typeof parseDatedDecisionId>,
  expectedDate: string | null,
  normalized: string
): DecisionApplicationFailure | null {
  if (
    explicit === null ||
    expectedDate === null ||
    explicit.date === expectedDate
  )
    return null;
  return renameFailure(
    "decision-records.rename-date-mismatch",
    "Target Decision ID date must match the source's authoritative date: " +
      expectedDate,
    "Use the source date with the intended semantic name.",
    normalized
  );
}

function datedDecisionIdForExpectedDate(
  name: string,
  expectedDate: string | null
): DecisionId | null {
  return expectedDate === null
    ? null
    : datedDecisionIdForName(name, expectedDate);
}

function invalidRenameIdentityFailure(
  normalized: string
): DecisionApplicationFailure {
  return renameFailure(
    "decision-records.rename-target-invalid",
    "Decision rename target must be a semantic name or calendar-valid YYMMDD-name ID: " +
      normalized,
    "Use lowercase kebab-case text, or a complete dated Decision ID.",
    normalized
  );
}

function renameIdentityConflict(
  source: RenameableDecisionRecord,
  records: readonly DecisionRecord[],
  identity: RenameIdentity
): DecisionApplicationFailure | null {
  const otherRecords = records.filter(
    (record) => record.decisionPath !== source.decisionPath
  );
  if (
    otherRecords.some((record) => record.decisionId === identity.decisionId)
  ) {
    return renameFailure(
      "decision-records.rename-id-conflict",
      "Target Decision ID already exists: " + identity.decisionId,
      "Choose an unused dated Decision ID.",
      identity.decisionId
    );
  }
  return renameNameConflict(otherRecords, identity.name);
}

function renameNameConflict(
  records: readonly DecisionRecord[],
  name: string
): DecisionApplicationFailure | null {
  if (
    !records.some(
      (record) =>
        isRenameableDecisionRecord(record) &&
        decisionNameFromId(record.decisionId) === name
    )
  )
    return null;
  return renameFailure(
    "decision-records.rename-name-conflict",
    "Target Decision name already exists in the current collection: " + name,
    "Choose a unique semantic name or resolve the existing record first.",
    name
  );
}
function isRenameableDecisionRecord(
  record: DecisionRecord
): record is RenameableDecisionRecord {
  return (
    isDecisionCandidateRecord(record) || isEstablishedDecisionRecord(record)
  );
}

function renameTargetLocation(
  source: RenameableDecisionRecord,
  records: readonly DecisionRecord[],
  identity: RenameIdentity
):
  | Readonly<{ status: "ok"; value: RenameTarget }>
  | DecisionApplicationFailure {
  if (source.status === null) {
    return renameFailure(
      "decision-records.rename-source-invalid",
      "Decision rename source has no valid lifecycle status: " +
        source.sourcePath,
      "Correct the Decision source before retrying rename.",
      source.sourcePath
    );
  }
  const occupied = new Set(
    records
      .filter((record) => record.decisionPath !== source.decisionPath)
      .map((record) => record.sourcePath)
  );
  const sourcePath = sourcePathForDecisionRename(
    identity.decisionId,
    identity.name,
    source.status,
    occupied
  );
  return sourcePath === null
    ? renamePathConflict(identity.decisionId)
    : { status: "ok", value: { ...identity, sourcePath } };
}

function renamePathConflict(
  decisionId: DecisionId
): DecisionApplicationFailure {
  return renameFailure(
    "decision-records.rename-path-conflict",
    "Both name and ID target paths are occupied for Decision " + decisionId,
    "Free one listed target path or choose a different name; no files were changed.",
    decisionId
  );
}
