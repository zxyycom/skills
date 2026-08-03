import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { StateSnapshot } from "../../index-runtime/src/index.ts";
import {
  decisionDomainFromRelativePath,
  isDecisionRelativePath
} from "./decision-path.ts";
import {
  decisionDomainCatalogFileName,
  loadDecisionDomainCatalog,
  type DecisionDomainCatalog
} from "./decision-domain-catalog.ts";
import { decisionMetadataFromCandidate } from "./decision-metadata.ts";
import { validateDecisionBody } from "./record.ts";
import type {
  DecisionDocument,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionProjection
} from "./types.ts";

const decisionSourceReadConcurrency = 32;

type DecisionSource = {
  path: string;
  text: string;
};

export function decisionIndexState(
  relativePath: string,
  document: DecisionDocument
): DecisionIndexState {
  const projection = canonicalDecisionProjection(document);
  return document.status === "active"
    ? {
        path: relativePath,
        title: projection.title,
        status: "active",
        alignment: document.alignment,
        createdAt: document.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      }
    : {
        path: relativePath,
        title: projection.title,
        status: "archived",
        alignment: document.alignment,
        createdAt: document.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      };
}

export function decisionSourceRevision(
  catalog: DecisionDomainCatalog,
  sources: readonly { path: string; text: string }[]
): string {
  const hash = createHash("sha256");
  hash.update("decision-index-source-v2\0");
  hashField(hash, normalizeDecisionDomainCatalog(catalog));
  for (const source of [...sources].sort((left, right) => compareText(
    left.path,
    right.path
  ))) {
    hashField(hash, source.path);
    hashField(hash, normalizeDecisionSourceText(source.text));
  }
  return `sha256:${hash.digest("hex")}`;
}

export async function readDecisionSourceRevision(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<string> {
  const [catalog, sources] = await Promise.all([
    readDecisionDomainCatalog(decisionsDirectory),
    readDecisionSources(decisionsDirectory, relativePaths, signal)
  ]);
  return decisionSourceRevision(catalog, sources);
}

export async function readDecisionStateSnapshot(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState, DecisionIndexMetadata>> {
  const [catalog, sources] = await Promise.all([
    readDecisionDomainCatalog(decisionsDirectory),
    readDecisionSources(decisionsDirectory, relativePaths, signal)
  ]);
  const domainIds = new Set(catalog.domains.map((domain) => domain.id));
  const states: DecisionIndexState[] = [];
  for (
    let offset = 0;
    offset < sources.length;
    offset += decisionSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision state read was aborted");
    }
    const batch = sources.slice(offset, offset + decisionSourceReadConcurrency);
    states.push(...await Promise.all(batch.map(async (source) => (
      await parseDecisionSource(decisionsDirectory, source, domainIds)
    ))));
  }
  return {
    metadata: {
      domains: catalog.domains.map(({ id, description }) => ({ id, description }))
    },
    revision: decisionSourceRevision(catalog, sources),
    states
  };
}

async function readDecisionSources(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<DecisionSource[]> {
  const sources: DecisionSource[] = [];
  const paths = [...new Set(relativePaths)].sort(compareText);
  for (
    let offset = 0;
    offset < paths.length;
    offset += decisionSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision source revision read was aborted");
    }
    const batch = paths.slice(offset, offset + decisionSourceReadConcurrency);
    sources.push(...await Promise.all(batch.map(async (relativePath) => (
      await readDecisionSource(decisionsDirectory, relativePath, signal)
    ))));
  }
  return sources;
}

async function readDecisionDomainCatalog(
  decisionsDirectory: string
): Promise<DecisionDomainCatalog> {
  const catalogPath = path.join(decisionsDirectory, decisionDomainCatalogFileName);
  const loaded = await loadDecisionDomainCatalog(
    catalogPath,
    decisionDomainCatalogFileName
  );
  if (loaded.status === "error") {
    throw new Error(loaded.errors.join("; "));
  }
  return loaded.value;
}

async function readDecisionSource(
  decisionsDirectory: string,
  relativePath: string,
  signal?: AbortSignal
): Promise<DecisionSource> {
  if (signal?.aborted === true) {
    throw new Error("decision source revision read was aborted");
  }
  if (!isDecisionRelativePath(relativePath)) {
    throw new Error(`invalid indexed decision path ${relativePath}`);
  }
  const sourcePath = path.join(decisionsDirectory, ...relativePath.split("/"));
  try {
    return {
      path: relativePath,
      text: await fs.readFile(sourcePath, "utf8")
    };
  } catch (error) {
    throw new Error(
      `failed to read indexed decision ${relativePath}: ${errorText(error)}`,
      { cause: error }
    );
  }
}

async function parseDecisionSource(
  decisionsDirectory: string,
  source: DecisionSource,
  domainIds: ReadonlySet<string>
): Promise<DecisionIndexState> {
  const errors: string[] = [];
  const domain = decisionDomainFromRelativePath(source.path);
  if (domain === null || !domainIds.has(domain)) {
    errors.push(
      `${source.path} path domain is not defined in `
      + `${decisionDomainCatalogFileName}: ${domain ?? "<invalid>"}`
    );
  }
  const candidate = await validateDecisionBody({
    body: source.text,
    decisionsDirectory,
    errors,
    fileName: path.posix.basename(source.path),
    relativePath: source.path
  });
  const metadata = candidate === null
    ? null
    : decisionMetadataFromCandidate(candidate);
  if (candidate === null || metadata === null || errors.length > 0) {
    throw new Error(
      errors.length > 0
        ? errors.join("; ")
        : `${source.path} does not contain established decision metadata`
    );
  }
  const projection = canonicalDecisionProjection(candidate);
  const document: DecisionDocument = metadata.status === "active"
    ? {
        title: projection.title,
        status: "active",
        alignment: metadata.alignment,
        createdAt: metadata.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      }
    : {
        title: projection.title,
        status: "archived",
        alignment: metadata.alignment,
        createdAt: metadata.createdAt,
        purpose: projection.purpose,
        background: projection.background,
        decision: projection.decision,
        relations: projection.relations
      };
  return decisionIndexState(source.path, document);
}

function canonicalDecisionProjection(
  source: DecisionProjection
): DecisionProjection {
  return {
    title: source.title,
    purpose: source.purpose,
    background: source.background,
    decision: source.decision,
    relations: source.relations.map(({ type, target }) => ({ type, target }))
  };
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
