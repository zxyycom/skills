import fs from "node:fs/promises";
import path from "node:path";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import {
  decisionDomainCatalogFileName,
  loadDecisionDomainCatalog,
  type DecisionDomainCatalog
} from "./decision-domain-catalog.ts";
import { isDecisionRelativePath } from "./decision-path.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { buildDecisionStateSnapshotFromSources } from "./decision-state-snapshot.ts";
import type {
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionSource
} from "./types.ts";

const decisionSourceReadConcurrency = 32;

type DecisionSourceInput = Readonly<{
  catalog: DecisionDomainCatalog;
  sources: readonly DecisionSource[];
}>;

export async function readDecisionSourceRevision(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<StateSourceRevision> {
  const input = await readDecisionSourceInput(
    decisionsDirectory,
    relativePaths,
    signal
  );
  return decisionSourceRevision(input.catalog, input.sources);
}

export async function readDecisionStateSnapshot(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<StateSnapshot<DecisionIndexState, DecisionIndexMetadata>> {
  const input = await readDecisionSourceInput(
    decisionsDirectory,
    relativePaths,
    signal
  );
  return await buildDecisionStateSnapshotFromSources(
    input.catalog,
    input.sources,
    signal
  );
}

async function readDecisionSourceInput(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<DecisionSourceInput> {
  const [catalog, sources] = await Promise.all([
    readDecisionDomainCatalog(decisionsDirectory),
    readDecisionSources(decisionsDirectory, relativePaths, signal)
  ]);
  return { catalog, sources };
}

async function readDecisionSources(
  decisionsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<DecisionSource[]> {
  const sources: DecisionSource[] = [];
  const paths = [...relativePaths].sort(compareText);
  if (new Set(paths).size !== paths.length) {
    throw new Error("decision sources must use unique paths");
  }
  for (
    let offset = 0;
    offset < paths.length;
    offset += decisionSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("decision source read was aborted");
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
    throw new Error("decision source read was aborted");
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
