import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { isInvestigationTopicPath } from "./report-path.ts";
import { buildInvestigationTopicState } from "./report-validation.ts";
import {
  investigationResourcesDirectoryName,
  readInvestigationResources
} from "./resources.ts";
import {
  investigationSourceRevision,
  prepareInvestigationSources
} from "./investigation-source-revision.ts";
import {
  type InvestigationIndexMetadata,
  type InvestigationResourceSource,
  type InvestigationIndexState,
  type InvestigationSource
} from "./types.ts";

const investigationSourceReadConcurrency = 32;

export async function discoverInvestigationTopicPaths(
  investigationsDirectory: string
): Promise<string[]> {
  return (await fastGlob("**/*.md", {
    cwd: investigationsDirectory,
    dot: false,
    followSymbolicLinks: false,
    ignore: [`${investigationResourcesDirectoryName}/**`],
    onlyFiles: true
  }))
    .map((relativePath) => relativePath.replace(/\\/gu, "/"))
    .sort(compareText);
}

export async function readInvestigationSourceRevision(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSourceRevision> {
  const collection = await readInvestigationCollection(
    investigationsDirectory,
    signal
  );
  return investigationSourceRevision(collection.sources, collection.resources);
}

export async function readInvestigationResourceMetadata(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationIndexMetadata> {
  const resources = await readInvestigationResources(
    investigationsDirectory,
    signal
  );
  return prepareInvestigationSources([], resources).metadata;
}

export async function readInvestigationStateSnapshot(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSnapshot<
  InvestigationIndexState,
  InvestigationIndexMetadata
>> {
  const collection = await readInvestigationCollection(
    investigationsDirectory,
    signal
  );
  return buildInvestigationStateSnapshot(
    collection.sources,
    collection.resources
  );
}

function buildInvestigationStateSnapshot(
  sources: readonly InvestigationSource[],
  resources: readonly InvestigationResourceSource[]
): StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata> {
  const prepared = prepareInvestigationSources(sources, resources);
  const states = prepared.sources.map((source) => {
    const built = buildInvestigationTopicState(
      source.path,
      parseInvestigationReport(source.text, source.path)
    );
    if (built.state === null) {
      throw new Error(built.errors.join("; "));
    }
    return built.state;
  });
  validateInvestigationResourceCoverage(states, prepared.metadata);

  return {
    metadata: prepared.metadata,
    sourceRevision: prepared.revision,
    states: Object.fromEntries(states.map((state) => [state.path, state]))
  };
}

async function readInvestigationCollection(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<{
  resources: InvestigationResourceSource[];
  sources: InvestigationSource[];
}> {
  const stat = await fs.stat(investigationsDirectory);
  if (!stat.isDirectory()) {
    throw new Error(`${investigationsDirectory} must be a directory`);
  }
  const [sources, resources] = await Promise.all([
    readInvestigationSources(investigationsDirectory, signal),
    readInvestigationResources(investigationsDirectory, signal)
  ]);
  return { resources, sources };
}

async function readInvestigationSources(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const relativePaths = await discoverInvestigationTopicPaths(
    investigationsDirectory
  );
  const sources: InvestigationSource[] = [];
  for (
    let offset = 0;
    offset < relativePaths.length;
    offset += investigationSourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("investigation source read was aborted");
    }
    const batch = relativePaths.slice(
      offset,
      offset + investigationSourceReadConcurrency
    );
    sources.push(...await Promise.all(batch.map(async (relativePath) => (
      await readInvestigationSource(investigationsDirectory, relativePath)
    ))));
  }
  return sources;
}

function validateInvestigationResourceCoverage(
  states: readonly InvestigationIndexState[],
  metadata: InvestigationIndexMetadata
): void {
  const available = new Set(metadata.resources.map((resource) => resource.id));
  const referenced = new Set(states.flatMap((state) => (
    state.resourceReferences.flatMap((reference) => reference.resourceIds)
  )));
  const errors = [
    ...[...referenced]
      .filter((id) => !available.has(id))
      .map((id) => `${investigationResourcesDirectoryName}/${id} does not exist`),
    ...[...available]
      .filter((id) => !referenced.has(id))
      .map((id) => `${investigationResourcesDirectoryName}/${id} is not referenced by any investigation report`)
  ];
  if (errors.length > 0) {
    throw new Error(errors.sort(compareText).join("; "));
  }
}

async function readInvestigationSource(
  investigationsDirectory: string,
  relativePath: string
): Promise<InvestigationSource> {
  if (!isInvestigationTopicPath(relativePath)) {
    throw new Error(`invalid investigation topic path ${relativePath}`);
  }
  try {
    return {
      path: relativePath,
      text: await fs.readFile(
        path.join(investigationsDirectory, ...relativePath.split("/")),
        "utf8"
      )
    };
  } catch (error) {
    throw new Error(
      `failed to read investigation topic ${relativePath}: ${errorText(error)}`,
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
