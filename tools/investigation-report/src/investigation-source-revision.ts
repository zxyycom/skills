import { createHash } from "node:crypto";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationResourceSource,
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
  sources: readonly InvestigationSource[],
  resources: readonly InvestigationResourceSource[] = []
): StateSourceRevision {
  return prepareInvestigationSources(sources, resources).revision;
}

export function prepareInvestigationSources(
  sources: readonly InvestigationSource[],
  resources: readonly InvestigationResourceSource[] = []
): PreparedInvestigationSources {
  const orderedSources = sources
    .map(({ path, text }) => ({ path, text }))
    .sort((left, right) => compareText(left.path, right.path));
  const sourcePaths = new Set(orderedSources.map((source) => source.path));
  if (sourcePaths.size !== orderedSources.length) {
    throw new Error("investigation sources must use unique paths");
  }
  const metadata = investigationResourceMetadata(resources);

  return {
    metadata,
    revision: {
      metadata: sourceFingerprint(
        "investigation-index-metadata-v2",
        ...metadata.resources.flatMap(({ id, sha256 }) => [id, sha256])
      ),
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

export function investigationResourceMetadata(
  resources: readonly InvestigationResourceSource[]
): InvestigationIndexMetadata {
  const orderedResources = resources
    .map(({ bytes, id }) => ({ bytes, id }))
    .sort((left, right) => compareText(left.id, right.id));
  const resourceIds = new Set(orderedResources.map((resource) => resource.id));
  if (resourceIds.size !== orderedResources.length) {
    throw new Error("investigation resources must use unique ids");
  }
  return {
    resources: orderedResources.map((resource) => ({
      id: resource.id,
      sha256: investigationResourceSha256(resource.bytes)
    }))
  };
}

function investigationResourceSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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
