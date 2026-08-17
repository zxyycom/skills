import { createHash } from "node:crypto";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationSource
} from "./types.ts";

export const investigationSourceFingerprintPatternSource =
  "^sha256:[0-9a-f]{64}$";

type PreparedInvestigationSources = Readonly<{
  metadata: InvestigationIndexMetadata;
  revision: StateSourceRevision;
  sources: readonly InvestigationSource[];
}>;

export function investigationSourceRevision(
  sources: readonly InvestigationSource[]
): StateSourceRevision {
  return prepareInvestigationSources(sources).revision;
}

export function prepareInvestigationSources(
  sources: readonly InvestigationSource[]
): PreparedInvestigationSources {
  const orderedSources = sources
    .map(({ path, text }) => ({ path, text }))
    .sort((left, right) => compareText(left.path, right.path));
  const sourcePaths = new Set(orderedSources.map((source) => source.path));
  if (sourcePaths.size !== orderedSources.length) {
    throw new Error("investigation sources must use unique paths");
  }
  return {
    metadata: {},
    revision: {
      metadata: sourceFingerprint("investigation-index-metadata-v3", "{}"),
      entries: Object.fromEntries(
        orderedSources.map((source) => [
          source.path,
          sourceFingerprint(
            "investigation-index-entry-v1",
            source.path,
            normalizeSourceText(source.text)
          )
        ])
      )
    },
    sources: orderedSources
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

function normalizeSourceText(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
