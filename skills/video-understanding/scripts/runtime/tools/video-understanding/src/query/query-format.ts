/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/query/query-format.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/query/query-format.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/query/query-format.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import type { Material } from "../evidence/evidence.ts";
import { failure } from "../failure.ts";
import type { QueryResult } from "./query.ts";
import type { ReadItem } from "./query-items.ts";

function transcriptHeader(
  item: ReadItem,
  materials: Map<string, Material>
): string {
  const material =
    item.material === undefined ? undefined : materials.get(item.material);
  if (material === undefined) {
    throw failure(
      {
        kind: "inconsistent",
        stage: "read",
        target: item.id,
        reason: "transcript material is absent from query sources"
      },
      "read the query and its material catalog from the same evidence snapshot"
    );
  }
  return (
    `transcripts material=${material.id} origin=${material.origin} status=${material.status} timeMeaning=${material.timeMeaning} availability=${item.availability}` +
    (item.reason === null ? "" : ` reason=${JSON.stringify(item.reason)}`)
  );
}

function formatReadingItems(
  result: QueryResult,
  materials: readonly Material[]
): string[] {
  const lines: string[] = [];
  const compactTranscripts =
    result.view === "raw" || result.view === "effective";
  const materialById = new Map(
    materials.map((material) => [material.id, material])
  );
  let previousHeader: string | null = null;
  for (const item of result.items) {
    if (
      !compactTranscripts ||
      item.kind !== "transcript" ||
      item.text === null ||
      item.availability === "unavailable"
    ) {
      previousHeader = null;
      lines.push(JSON.stringify(item, null, 2));
      continue;
    }
    const header = transcriptHeader(item, materialById);
    if (previousHeader !== header) lines.push(header);
    previousHeader = header;
    lines.push(
      `${item.id} [${item.start},${item.end}] ${JSON.stringify(item.text)}`
    );
  }
  return lines;
}
export function formatQuery(
  result: QueryResult,
  materials: readonly Material[]
): string {
  const lines = [
    `scopeId=${result.scopeId} version=5 output=${result.output} view=${result.view} adoption=${result.adoption} frames=${result.frameStatus} duration=${result.duration}`,
    `window=${result.window ? `[${result.window.start},${result.window.end})` : "none"} offset=${result.offset} items=${result.items.length}/${result.total} remaining=${result.remaining}`,
    ...(result.selection
      ? [`selection=${JSON.stringify(result.selection)}`]
      : []),
    ...formatReadingItems(result, materials),
    ...result.related.map((item) => `related ${JSON.stringify(item)}`),
    ...(result.relatedRemaining > 0
      ? [`relatedRemaining=${result.relatedRemaining}`]
      : []),
    ...result.warnings,
    "Sparse frames and authored/corrected groups are not continuous visual or speech coverage.",
    ...(result.nextOffset !== null
      ? [
          `next: repeat same scope/view/window with --offset ${result.nextOffset}`
        ]
      : [])
  ];
  return lines.join("\n");
}
