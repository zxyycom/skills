import type { LocatedOptions, ReadOptions } from "../cli/arguments.ts";
import type { Material } from "../evidence/evidence.ts";
import { failure } from "../failure.ts";
import type { IndexedRefinement, Snapshot } from "../refinement/refinement.ts";
import {
  calibrationItem,
  materialItem,
  ownItem,
  type ReadItem
} from "./query-items.ts";

function frameItems(
  snapshot: Snapshot,
  output: string,
  effective: boolean
): ReadItem[] {
  return snapshot.index.frames.entries.map((f) => {
    const entry = effective
      ? snapshot.records.find(
          (e) =>
            e.pointer.kind === "description" &&
            e.pointer.state === "active" &&
            e.pointer.refs.includes(f.id)
        )
      : undefined;
    return entry?.status === "valid"
      ? calibrationItem(entry, snapshot, output)
      : ownItem(f.id, snapshot, output);
  });
}
function subtitleItems(
  material: Material,
  snapshot: Snapshot,
  output: string,
  adopted: boolean
): ReadItem[] {
  const corrections = adopted
    ? snapshot.records.filter(
        (e) =>
          e.pointer.kind === "correction" &&
          e.pointer.state === "active" &&
          e.status === "valid" &&
          e.pointer.refs.some((id) => material.cues.some((c) => c.id === id))
      )
    : [];
  const covered = new Set(corrections.flatMap((e) => e.pointer.refs));
  return [
    ...material.cues
      .filter((c) => !covered.has(c.id))
      .map((c) => {
        const item = ownItem(c.id, snapshot, output);
        return adopted
          ? item
          : {
              ...item,
              availability: "unadopted" as const,
              reason:
                "single available subtitle; not selected or individually verified"
            };
      }),
    ...corrections.map((e) => calibrationItem(e, snapshot, output))
  ];
}
function rawItems(
  snapshot: Snapshot,
  options: LocatedOptions<ReadOptions>
): ReadItem[] {
  if (
    options.material &&
    !snapshot.index.materials.some(
      (material) => material.id === options.material
    )
  ) {
    throw failure({
      kind: "input",
      stage: "read",
      target: options.material,
      reason: "unknown material ID"
    });
  }
  const ids = snapshot.index.materials
    .filter((material) => !options.material || material.id === options.material)
    .flatMap((material) =>
      [...material.cues, ...material.observations].map((entry) => entry.id)
    );
  return [
    ...ids.map((id) => ownItem(id, snapshot, options.output)),
    ...(options.material ? [] : frameItems(snapshot, options.output, false))
  ];
}
function effectiveItems(
  snapshot: Snapshot,
  output: string
): { items: ReadItem[]; adoption: string } {
  const frames = frameItems(snapshot, output, true);
  const selection = snapshot.records.find(
    (e) => e.pointer.kind === "selection" && e.pointer.state === "active"
  );
  if (selection) {
    const selected = selectedItems(selection, snapshot, output);
    return { ...selected, items: [...selected.items, ...frames] };
  }
  const candidates = snapshot.materials.filter(
    (m) => m.status === "valid" && m.material.kind === "subtitle"
  );
  if (candidates.length === 1)
    return {
      items: [
        ...subtitleItems(candidates[0]!.material, snapshot, output, false),
        ...frames
      ],
      adoption: "unadopted-single-source"
    };
  return {
    items: [
      ...candidates.map((m) => materialItem(m.material, snapshot)),
      ...frames
    ],
    adoption: candidates.length ? "selection-required" : "no-subtitle"
  };
}
function selectedItems(
  selection: IndexedRefinement,
  snapshot: Snapshot,
  output: string
): { items: ReadItem[]; adoption: string } {
  if (selection.status === "invalid")
    return {
      items: [calibrationItem(selection, snapshot, output)],
      adoption: "unavailable"
    };
  const record = selection.record;
  if (record.kind === "selection" && record.mode === "source") {
    const material = snapshot.index.materials.find(
      (m) => m.id === record.material
    )!;
    return {
      items: subtitleItems(material, snapshot, output, true),
      adoption: "selected-source"
    };
  }
  return {
    items: [calibrationItem(selection, snapshot, output)],
    adoption: "authored"
  };
}
export function evidenceItems(
  snapshot: Snapshot,
  options: LocatedOptions<ReadOptions>
): { items: ReadItem[]; adoption: string } {
  switch (options.view) {
    case "materials":
      return {
        items: snapshot.index.materials.map((material) =>
          materialItem(material, snapshot)
        ),
        adoption: "catalog"
      };
    case "calibrations":
      return {
        items: snapshot.records.map((entry) =>
          calibrationItem(entry, snapshot, options.output)
        ),
        adoption: "maintenance"
      };
    case "raw":
      return { items: rawItems(snapshot, options), adoption: "raw" };
    case "effective":
      return effectiveItems(snapshot, options.output);
  }
}
