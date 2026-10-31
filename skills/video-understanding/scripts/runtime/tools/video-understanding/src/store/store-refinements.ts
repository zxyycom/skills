/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/store/store-refinements.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/store/store-refinements.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/store/store-refinements.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import type { Evidence } from "../evidence/evidence.ts";
import { failure, parseJson, validate, VideoFailure } from "../failure.ts";
import {
  RefinementSchema,
  targetRefs,
  validateReferences,
  type IndexedRefinement,
  type Snapshot
} from "../refinement/refinement.ts";
import { verifiedBytes } from "./store-artifacts.ts";

export async function secondary(
  output: string,
  pointer: Evidence["refinements"][number],
  scopeId: string
): Promise<IndexedRefinement> {
  try {
    const value = parseJson(
      (await verifiedBytes(output, pointer.payload)).toString("utf8"),
      { stage: "verification", target: pointer.id }
    );
    const payload = validate(RefinementSchema, value, {
      stage: "verification",
      target: pointer.id
    });
    if (
      payload.scopeId !== scopeId ||
      payload.id !== pointer.id ||
      payload.kind !== pointer.kind ||
      payload.revision !== pointer.revision ||
      payload.state !== pointer.state ||
      JSON.stringify(targetRefs(payload)) !== JSON.stringify(pointer.refs) ||
      JSON.stringify(payload.support) !== JSON.stringify(pointer.support)
    ) {
      throw failure({
        kind: "protocol",
        stage: "verification",
        target: pointer.id,
        reason: "secondary identity/target mismatch"
      });
    }
    return { pointer, status: "valid", record: payload };
  } catch (error) {
    if (!(error instanceof VideoFailure)) throw error;
    return {
      pointer,
      status: "invalid",
      reason: "unavailable or invalid secondary payload"
    };
  }
}
export function validateCalibrations(snapshot: Snapshot): void {
  const { records } = snapshot;
  for (const [position, entry] of records.entries()) {
    records[position] = referencedCalibration(entry, snapshot);
  }
  const active = records.filter(
    (entry) => entry.status === "valid" && entry.record.state === "active"
  );
  for (const [position, entry] of records.entries()) {
    if (entry.status !== "valid" || entry.record.state !== "active") continue;
    const conflict = active.some(
      (other) =>
        other.pointer.id !== entry.pointer.id &&
        other.pointer.kind === entry.pointer.kind &&
        (entry.pointer.kind === "selection" ||
          other.pointer.refs.some((id) => entry.pointer.refs.includes(id)))
    );
    if (conflict)
      records[position] = {
        pointer: entry.pointer,
        status: "invalid",
        reason: "unavailable or invalid secondary payload"
      };
  }
}
function referencedCalibration(
  entry: IndexedRefinement,
  snapshot: Snapshot
): IndexedRefinement {
  if (entry.status !== "valid") return entry;
  try {
    validateReferences(entry.record, snapshot);
    return entry;
  } catch (error) {
    if (!(error instanceof VideoFailure)) throw error;
    return {
      pointer: entry.pointer,
      record: entry.record,
      status: "invalid",
      reason: "raw targets or support unavailable"
    };
  }
}
