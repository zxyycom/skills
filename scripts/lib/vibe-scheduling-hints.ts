import fs from "node:fs/promises";
import path from "node:path";
import type { GateProfile } from "./vibe-gate.ts";

export const schedulingHintsFormatVersion = 1;

export type CheckDurationHint = Readonly<{
  checkId: string;
  durationMs: number | null;
}>;

export type GateSchedulingHints = Readonly<{
  read(
    profile: GateProfile,
    knownCheckIds: readonly string[]
  ): Promise<ReadonlyMap<string, number>>;
  write(
    profile: GateProfile,
    knownCheckIds: readonly string[],
    checkDurations: readonly CheckDurationHint[]
  ): Promise<void>;
}>;

type StoredHint = Readonly<{ checkId: string; durationMs: number }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hintFileName(
  profile: GateProfile
): `.vibe-check-scheduling-hints-${GateProfile}.json` {
  return `.vibe-check-scheduling-hints-${profile}.json`;
}

export function schedulingHintsRelativePath(profile: GateProfile): string {
  return hintFileName(profile);
}

function isDurationHint(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseSchedulingHints(
  content: string,
  expectedProfile: GateProfile,
  knownCheckIds: readonly string[]
): ReadonlyMap<string, number> {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !isRecord(value) ||
      value.version !== schedulingHintsFormatVersion ||
      value.profile !== expectedProfile ||
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
    async read(profile, knownCheckIds) {
      const content = await fs
        .readFile(path.join(workspaceRoot, hintFileName(profile)), "utf8")
        .catch(() => null);
      return content === null
        ? new Map()
        : parseSchedulingHints(content, profile, knownCheckIds);
    },
    async write(profile, knownCheckIds, checkDurations) {
      await fs.writeFile(
        path.join(workspaceRoot, hintFileName(profile)),
        `${JSON.stringify({
          hints: currentDurationHints(checkDurations, knownCheckIds),
          profile,
          version: schedulingHintsFormatVersion
        })}\n`,
        "utf8"
      );
    }
  };
}
