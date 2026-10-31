/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/refinement/refinement.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/refinement/refinement.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/refinement/refinement.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { stableId, type Evidence, type Segment } from "../evidence/evidence.ts";
import { failure, validate } from "../failure.ts";
import {
  DraftSchema,
  RefinementSchema,
  type Draft,
  type Refinement,
  type Snapshot,
  type IndexedRefinement
} from "./refinement-schema.ts";
export { DraftSchema, RefinementSchema } from "./refinement-schema.ts";
export type {
  Draft,
  Refinement,
  Snapshot,
  Pointer,
  IndexedMaterial,
  IndexedRefinement
} from "./refinement-schema.ts";

export function parseDraft(value: unknown): Draft {
  return validate(DraftSchema, value, {
    stage: "refine",
    target: "refine input"
  });
}
export function activeRecords(snapshot: Snapshot): Refinement[] {
  return snapshot.records.flatMap((entry) =>
    entry.status === "valid" && entry.record.state === "active"
      ? [entry.record]
      : []
  );
}
function reject(reason: string): never {
  throw failure({
    kind: "input",
    stage: "refine",
    target: "reference IDs",
    reason
  });
}
type Content = Exclude<Draft, { action: "revoke" }> | Refinement;
export function consecutiveTargets(
  index: Evidence,
  targets: string[]
): boolean {
  const material = index.materials.find((entry) =>
    entry.cues.some((cue) => cue.id === targets[0])
  );
  const positions = targets.map(
    (id) => material?.cues.findIndex((cue) => cue.id === id) ?? -1
  );
  return (
    positions.length > 0 &&
    positions.every(
      (position, i) =>
        position >= 0 && (i === 0 || position === positions[i - 1]! + 1)
    )
  );
}
function validateCorrection(
  record: Extract<Content, { kind: "correction" }>,
  index: Evidence
): void {
  if (!consecutiveTargets(index, record.targets))
    reject(
      "correction requires consecutive ordered transcript IDs in one material"
    );
  const duration = index.duration;
  if (
    duration === null ||
    !orderedWithinDuration(record.replacement.segments, duration)
  ) {
    reject("replacement segments must be ordered within media duration");
  }
}
function orderedWithinDuration(segments: Segment[], duration: number): boolean {
  let previousStart: number | undefined;
  for (const segment of segments) {
    if (segment.end > duration) return false;
    if (previousStart !== undefined && segment.start < previousStart)
      return false;
    previousStart = segment.start;
  }
  return true;
}
export function targetRefs(record: Content): string[] {
  if (record.kind === "correction") return record.targets;
  if (record.kind === "selection" && record.mode === "source")
    return [record.material];
  return record.refs;
}
export function validateReferences(
  record: Content,
  snapshot: Snapshot,
  requireCurrent = true
): void {
  const refs = [
    ...targetRefs(record),
    ...record.support,
    ...record.verified.refs
  ];
  const known = new Set([
    ...snapshot.index.materials.map((m) => m.id),
    ...snapshot.index.materials.flatMap((m) =>
      [...m.cues, ...m.observations].map((c) => c.id)
    ),
    ...snapshot.index.frames.entries.map((f) => f.id)
  ]);
  for (const id of refs) {
    if (!known.has(id)) reject(`unknown raw reference ${id}`);
    if (requireCurrent && snapshot.unavailable.has(id))
      reject(`unavailable reference ${id}: ${snapshot.unavailable.get(id)}`);
  }
  if (record.kind === "selection" && record.mode === "source") {
    validateSourceSelection(record.material, snapshot.index);
  }
  if (record.kind === "correction") {
    validateCorrection(record, snapshot.index);
  }
}
function validateSourceSelection(id: string, index: Evidence): void {
  const material = index.materials.find((entry) => entry.id === id);
  if (
    !material ||
    material.kind !== "subtitle" ||
    !["complete", "empty"].includes(material.status)
  )
    reject("source selection requires a successful subtitle material");
}
function assertNoOverlap(candidate: Refinement, snapshot: Snapshot): void {
  const conflict = snapshot.index.refinements.find(
    (other) =>
      other.state === "active" &&
      other.id !== candidate.id &&
      other.kind === candidate.kind &&
      (candidate.kind === "selection" ||
        other.refs.some((id) => targetRefs(candidate).includes(id)))
  );
  if (conflict)
    reject(
      `active ${candidate.kind} overlaps ${conflict.id}; explicitly update or revoke that ID`
    );
}
export function refineRecord(draft: Draft, snapshot: Snapshot): Refinement {
  if (draft.scopeId !== snapshot.index.scopeId)
    reject("scopeId differs from the selected evidence directory");
  const previous = previousRevision(draft, snapshot);
  if (draft.action === "revoke") {
    return revokedRecord(previous);
  }
  if (previous && previous.pointer.kind !== draft.kind)
    reject("updates cannot change record kind");
  validateReferences(draft, snapshot);
  const id = refinementId(draft, snapshot.index);
  const candidate = validate(
    RefinementSchema,
    {
      ...draftContent(draft),
      id,
      revision: (previous?.pointer.revision ?? 0) + 1,
      state: "active"
    },
    { stage: "refine", target: id }
  );
  assertNoOverlap(candidate, snapshot);
  return candidate;
}
function previousRevision(
  draft: Draft,
  snapshot: Snapshot
): IndexedRefinement | undefined {
  if (draft.action === "create") return undefined;
  const previous = snapshot.records.find(
    (entry) => entry.pointer.id === draft.id
  );
  if (!previous || previous.pointer.revision !== draft.expectedRevision)
    reject(
      "target ID missing or expectedRevision mismatch; reread before updating"
    );
  return previous;
}
function refinementId(
  draft: Exclude<Draft, { action: "revoke" }>,
  index: Evidence
): string {
  if (draft.action === "update") return draft.id;
  const prefix = { correction: "C", description: "D", selection: "S" } as const;
  const identities = index.refinements.filter(
    (pointer) => pointer.kind === draft.kind
  );
  const ordinal =
    Math.max(0, ...identities.map((pointer) => Number(pointer.id.slice(1)))) +
    1;
  return stableId(prefix[draft.kind], ordinal);
}
function draftContent(draft: Exclude<Draft, { action: "revoke" }>) {
  if (draft.action === "update") {
    const { action: _action, expectedRevision: _revision, ...content } = draft;
    return content;
  }
  const { action: _action, ...content } = draft;
  return content;
}
function revokedRecord(previous: IndexedRefinement | undefined): Refinement {
  if (!previous?.record)
    reject(
      "cannot revoke damaged payload; explicitly update it with complete content"
    );
  if (previous.record.state === "revoked") reject("target is already revoked");
  return {
    ...previous.record,
    revision: previous.pointer.revision + 1,
    state: "revoked"
  };
}
