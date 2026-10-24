import type { Evidence, Material } from "./evidence.ts";
import { failure } from "./failure.ts";
import { consecutiveTargets, type Pointer } from "./refinement.ts";

function rejectManifest(reason: string): never {
  throw failure({
    kind: "protocol",
    stage: "manifest",
    target: "references",
    reason
  });
}
function checkMaterialLocators(material: Material, index: Evidence): void {
  const hasEntries = material.cues.length || material.observations.length;
  if (!["complete", "empty"].includes(material.status) && hasEntries) {
    rejectManifest("failed attempt cannot publish raw entries");
  }
  const ranges = [
    ...material.requestedCoverage,
    ...material.processedCoverage,
    ...material.cues
  ];
  const duration = index.duration;
  if (duration !== null && ranges.some((range) => range.end > duration)) {
    rejectManifest("material coverage outside media duration");
  }
  const wrongLocators =
    material.kind === "subtitle"
      ? material.observations.length
      : material.cues.length;
  if (wrongLocators) {
    rejectManifest("material kind/locator mismatch");
  }
  for (const observation of material.observations) {
    if (!index.frames.entries.some((frame) => frame.id === observation.frame)) {
      rejectManifest("dangling observation frame");
    }
  }
}
function checkCalibrationTargets(pointer: Pointer, index: Evidence): void {
  switch (pointer.kind) {
    case "correction":
      if (!consecutiveTargets(index, pointer.refs)) {
        rejectManifest(
          "invalid registered calibration target: correction requires ordered consecutive targets within one material"
        );
      }
      return;
    case "description":
      return checkDescriptionTarget(pointer);
    case "selection":
      return checkSelectionTarget(pointer);
  }
}
function checkDescriptionTarget(pointer: Pointer): void {
  if (
    pointer.refs.length !== 1 ||
    !pointer.refs[0]!.startsWith("F") ||
    pointer.support.some((id) => id.startsWith("F"))
  )
    rejectManifest(
      "invalid registered calibration target: description requires one frame and T/O support"
    );
}
function checkSelectionTarget(pointer: Pointer): void {
  const referencesMaterial = pointer.refs.some((id) => id.startsWith("M"));
  const singleMaterial =
    pointer.refs.length === 1 && pointer.refs[0]!.startsWith("M");
  if (!pointer.refs.length || (referencesMaterial && !singleMaterial))
    rejectManifest("invalid selection target");
}
function checkRevisionSequence(pointer: Pointer, revisions: Set<string>): void {
  if (
    pointer.id[0] !==
    { correction: "C", description: "D", selection: "S" }[pointer.kind]
  )
    rejectManifest("calibration prefix mismatch");
  for (let revision = 1; revision < pointer.revision; revision++) {
    if (!revisions.has(`${pointer.id}:${revision}`))
      rejectManifest("missing calibration revision");
  }
}
function checkCalibrationHistory(index: Evidence, known: Set<string>): void {
  const revisions = new Set<string>();
  for (const pointer of [...index.refinements, ...index.history]) {
    if (
      pointer.refs.some((id) => !known.has(id) || /^[SCD]/.test(id)) ||
      pointer.support.some((id) => !known.has(id))
    )
      rejectManifest("dangling raw calibration reference");
    checkCalibrationTargets(pointer, index);
    const identity = `${pointer.id}:${pointer.revision}`;
    if (revisions.has(identity))
      rejectManifest("duplicate calibration revision");
    revisions.add(identity);
    const current = index.refinements.find((entry) => entry.id === pointer.id);
    if (
      !current ||
      pointer.revision > current.revision ||
      pointer.kind !== current.kind
    )
      rejectManifest("invalid calibration history");
  }
  for (const pointer of index.refinements) {
    checkRevisionSequence(pointer, revisions);
  }
}
export function checkManifest(index: Evidence): void {
  const ids = [
    ...index.materials.flatMap((material) => [
      material.id,
      ...material.cues.map((cue) => cue.id),
      ...material.observations.map((observation) => observation.id)
    ]),
    ...index.frames.entries.map((frame) => frame.id),
    ...index.refinements.map((entry) => entry.id)
  ];
  if (new Set(ids).size !== ids.length)
    throw failure({
      kind: "protocol",
      stage: "verification",
      target: "IDs",
      reason: "duplicate evidence identity"
    });
  for (const material of index.materials)
    checkMaterialLocators(material, index);
  checkCalibrationHistory(index, new Set(ids));
}
