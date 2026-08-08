import { createHash } from "node:crypto";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";
import type { DecisionDomainCatalog } from "./decision-domain-catalog.ts";
import type { DecisionSource } from "./types.ts";

export const decisionSourceFingerprintPatternSource =
  "^sha256:[0-9a-f]{64}$";

type PreparedDecisionSources = Readonly<{
  revision: StateSourceRevision;
  sourcePaths: ReadonlySet<string>;
  sources: readonly DecisionSource[];
}>;

export function decisionSourceRevision(
  catalog: DecisionDomainCatalog,
  sources: readonly DecisionSource[]
): StateSourceRevision {
  return prepareDecisionSources(catalog, sources).revision;
}

export function prepareDecisionSources(
  catalog: DecisionDomainCatalog,
  sources: readonly DecisionSource[]
): PreparedDecisionSources {
  const orderedSources = sources
    .map(({ path, text }) => ({ path, text }))
    .sort((left, right) => compareText(left.path, right.path));
  const paths = new Set(orderedSources.map((source) => source.path));
  if (paths.size !== orderedSources.length) {
    throw new Error("decision sources must use unique paths");
  }
  return {
    revision: {
      metadata: sourceFingerprint(
        "decision-index-metadata-v1",
        normalizeDecisionDomainCatalog(catalog)
      ),
      entries: Object.fromEntries(orderedSources.map((source) => [
        source.path,
        sourceFingerprint(
          "decision-index-entry-v1",
          source.path,
          normalizeDecisionSourceText(source.text)
        )
      ]))
    },
    sourcePaths: paths,
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

function normalizeDecisionDomainCatalog(catalog: DecisionDomainCatalog): string {
  return JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    domains: catalog.domains.map(({ id, description }) => ({ id, description }))
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
