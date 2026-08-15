import { createHash } from "node:crypto";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";
import type { DecisionSource } from "./types.ts";

export const decisionSourceFingerprintPatternSource =
  "^sha256:[0-9a-f]{64}$";

type PreparedDecisionSources = Readonly<{
  decisionIds: ReadonlySet<string>;
  revision: StateSourceRevision;
  sources: readonly DecisionSource[];
}>;

export function decisionSourceRevision(
  sources: readonly DecisionSource[]
): StateSourceRevision {
  return prepareDecisionSources(sources).revision;
}

export function prepareDecisionSources(
  sources: readonly DecisionSource[]
): PreparedDecisionSources {
  const orderedSources = sources
    .map(({ decisionId, sourcePath, text }) => ({ decisionId, sourcePath, text }))
    .sort((left, right) => compareText(left.decisionId, right.decisionId));
  const decisionIds = new Set(orderedSources.map((source) => source.decisionId));
  if (decisionIds.size !== orderedSources.length) {
    throw new Error("decision sources must use unique Decision IDs");
  }
  const sourcePaths = new Set(orderedSources.map((source) => source.sourcePath));
  if (sourcePaths.size !== orderedSources.length) {
    throw new Error("decision sources must use unique source paths");
  }
  return {
    decisionIds,
    revision: {
      metadata: sourceFingerprint("decision-index-metadata-v2", "{}"),
      entries: Object.fromEntries(orderedSources.map((source) => [
        source.decisionId,
        sourceFingerprint(
          "decision-index-entry-v2",
          source.decisionId,
          source.sourcePath,
          normalizeDecisionSourceText(source.text)
        )
      ]))
    },
    sources: orderedSources
  };
}

function sourceFingerprint(label: string, ...fields: readonly string[]): string {
  const hash = createHash("sha256");
  hash.update(label + "\0");
  for (const field of fields) {
    hashField(hash, field);
  }
  return `sha256:${hash.digest("hex")}`;
}

function hashField(hash: ReturnType<typeof createHash>, value: string): void {
  hash.update(String(Buffer.byteLength(value, "utf8")));
  hash.update(":");
  hash.update(value, "utf8");
  hash.update("\0");
}

function normalizeDecisionSourceText(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
