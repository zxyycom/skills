import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  StateSnapshot,
  StateSourceRevision
} from "../../index-runtime/src/index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import {
  investigationIndexFileName,
  isInvestigationCategory,
  isInvestigationTopicPath,
  validateInvestigationTopicPath
} from "./report-path.ts";
import { buildInvestigationTopicState } from "./report-validation.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import {
  investigationSourceRevision,
  prepareInvestigationSources
} from "./investigation-source-revision.ts";
import {
  type InvestigationIndexMetadata,
  type InvestigationIndexState,
  type InvestigationSource
} from "./types.ts";

const investigationSourceReadConcurrency = 32;

export type InvestigationCollectionLayout = {
  errors: string[];
  topicPaths: string[];
};

export async function discoverInvestigationTopicPaths(
  investigationsDirectory: string
): Promise<string[]> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (layout.errors.length > 0) {
    throw new Error(layout.errors.join("; "));
  }
  return layout.topicPaths;
}

export async function inspectInvestigationCollectionLayout(
  investigationsDirectory: string
): Promise<InvestigationCollectionLayout> {
  const errors: string[] = [];
  const topicPaths: string[] = [];
  let rootEntries: Dirent<string>[];
  try {
    rootEntries = await fs.readdir(investigationsDirectory, {
      withFileTypes: true
    });
  } catch (error) {
    throw new Error(
      `investigation root could not be read: ${errorText(error)}`,
      { cause: error }
    );
  }
  rootEntries.sort((left, right) => compareText(left.name, right.name));

  for (const entry of rootEntries) {
    if (entry.name === investigationResourcesDirectoryName) {
      continue;
    }
    if (entry.name === investigationIndexFileName) {
      if (entry.isSymbolicLink()) {
        errors.push(
          `${investigationIndexFileName} must not be a symbolic link`
        );
      } else if (!entry.isFile()) {
        errors.push(`${investigationIndexFileName} must be a regular file`);
      }
      continue;
    }
    if (entry.isSymbolicLink()) {
      errors.push(`${entry.name} must not be a symbolic link`);
      continue;
    }
    if (!entry.isDirectory()) {
      errors.push(
        ...(entry.name.endsWith(".md")
          ? validateInvestigationTopicPath(entry.name)
          : [`${entry.name} is not allowed at the investigation root`])
      );
      continue;
    }
    if (!isInvestigationCategory(entry.name)) {
      errors.push(`${entry.name} category must use kebab-case`);
      continue;
    }

    let categoryEntries: Dirent<string>[];
    try {
      categoryEntries = await fs.readdir(
        path.join(investigationsDirectory, entry.name),
        { withFileTypes: true }
      );
    } catch (error) {
      errors.push(
        `${entry.name} category could not be read: ${errorText(error)}`
      );
      continue;
    }
    categoryEntries.sort((left, right) => compareText(left.name, right.name));
    for (const topicEntry of categoryEntries) {
      const relativePath = `${entry.name}/${topicEntry.name}`;
      if (topicEntry.isSymbolicLink()) {
        errors.push(`${relativePath} must not be a symbolic link`);
        continue;
      }
      if (!topicEntry.isFile()) {
        errors.push(
          `${relativePath} category directories must contain only topic Markdown files`
        );
        continue;
      }
      const pathErrors = validateInvestigationTopicPath(relativePath);
      if (pathErrors.length > 0) {
        errors.push(...pathErrors);
        continue;
      }
      topicPaths.push(relativePath);
    }
  }

  return {
    errors: [...new Set(errors)].sort(compareText),
    topicPaths: topicPaths.sort(compareText)
  };
}

export async function readInvestigationSourceRevision(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSourceRevision> {
  return investigationSourceRevision(
    await readInvestigationCollection(investigationsDirectory, signal)
  );
}

export async function readInvestigationStateSnapshot(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata>> {
  return buildInvestigationStateSnapshot(
    await readInvestigationCollection(investigationsDirectory, signal)
  );
}

function buildInvestigationStateSnapshot(
  sources: readonly InvestigationSource[]
): StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata> {
  const errors: string[] = [];
  const states: InvestigationIndexState[] = [];
  for (const source of sources) {
    const built = buildInvestigationTopicState(
      source.path,
      parseInvestigationReport(source.text, source.path)
    );
    if (built.status === "invalid") {
      errors.push(...built.errors);
    } else {
      states.push(built.state);
    }
  }
  if (errors.length > 0) {
    throw new Error([...new Set(errors)].sort(compareText).join("; "));
  }
  return createInvestigationStateSnapshot(sources, states);
}

export function createInvestigationStateSnapshot(
  sources: readonly InvestigationSource[],
  states: readonly InvestigationIndexState[]
): StateSnapshot<InvestigationIndexState, InvestigationIndexMetadata> {
  const prepared = prepareInvestigationSources(sources);
  const sourcePaths = new Set(prepared.sources.map((source) => source.path));
  const statesByPath = new Map<string, InvestigationIndexState>();
  for (const state of states) {
    if (statesByPath.has(state.path)) {
      throw new Error(
        `investigation state ${state.path} has a duplicate state projection`
      );
    }
    if (!sourcePaths.has(state.path)) {
      throw new Error(
        `investigation state ${state.path} has no matching source`
      );
    }
    statesByPath.set(state.path, state);
  }
  return {
    metadata: prepared.metadata,
    sourceRevision: prepared.revision,
    states: Object.fromEntries(
      prepared.sources.map((source) => {
        const state = statesByPath.get(source.path);
        if (state === undefined) {
          throw new Error(
            `investigation source ${source.path} has no state projection`
          );
        }
        return [source.path, state];
      })
    )
  };
}

async function readInvestigationCollection(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  if (layout.errors.length > 0) {
    throw new Error(layout.errors.join("; "));
  }
  if (layout.topicPaths.length === 0) {
    throw new Error("investigation collection must contain at least one topic");
  }
  return await readInvestigationSources(
    investigationsDirectory,
    layout.topicPaths,
    signal
  );
}

async function readInvestigationSources(
  investigationsDirectory: string,
  relativePaths: readonly string[],
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
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
    sources.push(
      ...(await Promise.all(
        batch.map(
          async (relativePath) =>
            await readInvestigationSource(investigationsDirectory, relativePath)
        )
      ))
    );
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
