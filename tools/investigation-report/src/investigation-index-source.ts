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
  investigationSourceRevision,
  prepareInvestigationSources
} from "./investigation-source-revision.ts";
import {
  investigationIndexMetadata,
  type InvestigationIndexMetadata,
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
    onlyFiles: true
  }))
    .map((relativePath) => relativePath.replace(/\\/gu, "/"))
    .sort(compareText);
}

export async function readInvestigationSourceRevision(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSourceRevision> {
  const sources = await readInvestigationSources(
    investigationsDirectory,
    signal
  );
  return investigationSourceRevision(sources);
}

export async function readInvestigationStateSnapshot(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSnapshot<
  InvestigationIndexState,
  InvestigationIndexMetadata
>> {
  const sources = await readInvestigationSources(
    investigationsDirectory,
    signal
  );
  return buildInvestigationStateSnapshot(sources);
}

function buildInvestigationStateSnapshot(
  sources: readonly InvestigationSource[]
): StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata> {
  const prepared = prepareInvestigationSources(sources);
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

  return {
    metadata: investigationIndexMetadata,
    sourceRevision: prepared.revision,
    states: Object.fromEntries(states.map((state) => [state.path, state]))
  };
}

async function readInvestigationSources(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const stat = await fs.stat(investigationsDirectory);
  if (!stat.isDirectory()) {
    throw new Error(`${investigationsDirectory} must be a directory`);
  }
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
