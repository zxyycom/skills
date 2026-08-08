import { createHash, type Hash } from "node:crypto";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";
import type { TestEvidenceCatalogSource } from "./catalog-source.ts";
import { testEvidenceCaseIdFromFirstLine } from "./catalog-identity.ts";
import {
  testEvidenceCaseIdPatternSource,
  type TestEvidenceTopicCatalog
} from "./schemas.ts";
import {
  normalizeTestEvidenceTopicCatalog
} from "./topic-catalog.ts";

export type IdentifiedTestEvidenceCatalogSource = Readonly<{
  id: string;
  path: string;
  text: string;
}>;

const caseIdPattern = new RegExp(testEvidenceCaseIdPatternSource, "u");

export function identifyTestEvidenceCatalogSource(
  source: TestEvidenceCatalogSource
): IdentifiedTestEvidenceCatalogSource {
  const id = testEvidenceCaseIdFromFirstLine(source.text, caseIdPattern);
  if (id === null) {
    throw new TypeError(
      `${source.path} must start with a valid test evidence case heading`
    );
  }
  return {
    id,
    path: source.path,
    text: source.text
  };
}

export function testEvidenceSourceRevision(options: {
  sources: readonly IdentifiedTestEvidenceCatalogSource[];
  topicCatalog: TestEvidenceTopicCatalog;
}): StateSourceRevision {
  const entries: Record<string, string> = Object.create(null);
  const sortedSources = [...options.sources].sort((left, right) => (
    compareText(left.path, right.path)
  ));
  for (const source of sortedSources) {
    if (Object.hasOwn(entries, source.id)) {
      throw new TypeError(`duplicate test evidence case id: ${source.id}`);
    }
    entries[source.id] = sourceFingerprint(
      "test-evidence-index-entry-v1",
      source.path,
      normalizeSourceText(source.text)
    );
  }
  return {
    entries,
    metadata: sourceFingerprint(
      "test-evidence-index-metadata-v1",
      normalizeTestEvidenceTopicCatalog(options.topicCatalog)
    )
  };
}

function normalizeSourceText(value: string): string {
  return value.replace(/\r\n/gu, "\n");
}

function sourceFingerprint(domain: string, ...values: string[]): string {
  const hash = createHash("sha256");
  hash.update(`${domain}\0`, "utf8");
  for (const value of values) {
    hashField(hash, value);
  }
  return `sha256:${hash.digest("hex")}`;
}

function hashField(hash: Hash, value: string): void {
  const byteLength = Buffer.byteLength(value, "utf8");
  hash.update(`${byteLength}:`, "utf8");
  hash.update(value, "utf8");
  hash.update("\0", "utf8");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
