import { createHash } from "node:crypto";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";
import {
  decisionIdFromSourcePath,
  isDecisionId,
  isDecisionSourcePath
} from "./decision-path.ts";
import type {
  DecisionId,
  DecisionSource,
  DecisionSourceInput
} from "./types.ts";

export const decisionSourceFingerprintPatternSource = "^sha256:[0-9a-f]{64}$";

type PreparedDecisionSources = Readonly<{
  decisionIds: ReadonlySet<DecisionId>;
  revision: StateSourceRevision;
  sources: readonly DecisionSource[];
}>;

export function decisionSourceRevision(
  sources: readonly DecisionSourceInput[]
): StateSourceRevision {
  return prepareDecisionSources(sources).revision;
}

export function prepareDecisionSources(
  sources: readonly DecisionSourceInput[]
): PreparedDecisionSources {
  const orderedSources = sources
    .map(parseDecisionSourceInput)
    .sort((left, right) => compareText(left.decisionId, right.decisionId));
  const decisionIds = new Set(
    orderedSources.map((source) => source.decisionId)
  );
  if (decisionIds.size !== orderedSources.length) {
    throw new Error("decision sources must use unique Decision IDs");
  }
  const sourcePaths = new Set(
    orderedSources.map((source) => source.sourcePath)
  );
  if (sourcePaths.size !== orderedSources.length) {
    throw new Error("decision sources must use unique source paths");
  }
  return {
    decisionIds,
    revision: {
      metadata: sourceFingerprint("decision-index-metadata-v2", "{}"),
      entries: Object.fromEntries(
        orderedSources.map((source) => [
          source.decisionId,
          sourceFingerprint(
            "decision-index-entry-v2",
            source.decisionId,
            source.sourcePath,
            normalizeDecisionSourceText(source.text)
          )
        ])
      )
    },
    sources: orderedSources
  };
}

function parseDecisionSourceInput(source: DecisionSourceInput): DecisionSource {
  if (!isDecisionId(source.decisionId)) {
    throw new TypeError(
      "decision source uses an invalid Decision ID: " + source.decisionId
    );
  }
  if (!isDecisionSourcePath(source.sourcePath)) {
    throw new TypeError(
      "decision source uses an invalid source path: " + source.sourcePath
    );
  }
  if (decisionIdFromSourcePath(source.sourcePath) !== source.decisionId) {
    throw new TypeError(
      "decision source path does not match Decision ID " +
        source.decisionId +
        ": " +
        source.sourcePath
    );
  }
  return {
    decisionId: source.decisionId,
    sourcePath: source.sourcePath,
    text: source.text
  };
}

function sourceFingerprint(
  label: string,
  ...fields: readonly string[]
): string {
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
