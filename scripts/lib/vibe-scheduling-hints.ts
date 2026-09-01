import fs from "node:fs/promises";
import path from "node:path";
import { normalizeGateTags, type GateTagSet } from "./vibe-gate.ts";

export const schedulingHintsFormatVersion = 2;

export type CheckDurationHint = Readonly<{
  checkId: string;
  durationMs: number | null;
}>;

export type GateSchedulingHints = Readonly<{
  read(
    activeTags: GateTagSet,
    knownCheckIds: readonly string[]
  ): Promise<ReadonlyMap<string, number>>;
  write(
    activeTags: GateTagSet,
    knownCheckIds: readonly string[],
    checkDurations: readonly CheckDurationHint[]
  ): Promise<void>;
}>;

type StoredHint = Readonly<{ checkId: string; durationMs: number }>;

type SchedulingHintsScope = "base" | "release";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function schedulingHintsScope(activeTags: GateTagSet): SchedulingHintsScope {
  return normalizeGateTags(activeTags).includes("release") ? "release" : "base";
}

function hintFileName(
  activeTags: GateTagSet
): `.vibe-check-scheduling-hints-${SchedulingHintsScope}.json` {
  return `.vibe-check-scheduling-hints-${schedulingHintsScope(activeTags)}.json`;
}

export function schedulingHintsRelativePath(activeTags: GateTagSet): string {
  return hintFileName(activeTags);
}

function isDurationHint(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseSchedulingHints(
  content: string,
  expectedTags: GateTagSet,
  knownCheckIds: readonly string[]
): ReadonlyMap<string, number> {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !isRecord(value) ||
      value.version !== schedulingHintsFormatVersion ||
      JSON.stringify(value.tags) !==
        JSON.stringify(normalizeGateTags(expectedTags)) ||
      !Array.isArray(value.hints)
    ) {
      return new Map();
    }
    const known = new Set(knownCheckIds);
    const hints = new Map<string, number>();
    for (const hint of value.hints) {
      if (
        isRecord(hint) &&
        typeof hint.checkId === "string" &&
        known.has(hint.checkId) &&
        isDurationHint(hint.durationMs)
      ) {
        hints.set(hint.checkId, hint.durationMs);
      }
    }
    return hints;
  } catch {
    return new Map();
  }
}

function currentDurationHints(
  checkDurations: readonly CheckDurationHint[],
  knownCheckIds: readonly string[]
): readonly StoredHint[] {
  const known = new Set(knownCheckIds);
  const hints = new Map<string, number>();
  for (const { checkId, durationMs } of checkDurations) {
    if (known.has(checkId) && isDurationHint(durationMs)) {
      hints.set(checkId, durationMs);
    }
  }
  return [...hints]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([checkId, durationMs]) => ({ checkId, durationMs }));
}

export function createGateSchedulingHints(
  workspaceRoot: string
): GateSchedulingHints {
  return {
    async read(activeTags, knownCheckIds) {
      const content = await fs
        .readFile(path.join(workspaceRoot, hintFileName(activeTags)), "utf8")
        .catch(() => null);
      return content === null
        ? new Map()
        : parseSchedulingHints(content, activeTags, knownCheckIds);
    },
    async write(activeTags, knownCheckIds, checkDurations) {
      await fs.writeFile(
        path.join(workspaceRoot, hintFileName(activeTags)),
        `${JSON.stringify({
          hints: currentDurationHints(checkDurations, knownCheckIds),
          tags: normalizeGateTags(activeTags),
          version: schedulingHintsFormatVersion
        })}\n`,
        "utf8"
      );
    }
  };
}
