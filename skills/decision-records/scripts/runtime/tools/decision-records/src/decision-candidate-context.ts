/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-candidate-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-candidate-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-candidate-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import path from "node:path";
import fs from "node:fs/promises";
import type {
  DecisionStageSource,
  FilesystemDecisionCandidates
} from "./decision-stage-contracts.ts";
import type { DecisionId, DecisionIndex } from "./types.ts";
import { readFilesystemDecisionCandidates } from "./decision-stage-sources.ts";
import {
  decisionNameFromId,
  isDecisionId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import { loadDecisionIndex } from "./decision-state-index.ts";
import { scanSourceFiles } from "./scan-records.ts";
import type { DecisionScanOptions } from "./types.ts";

/** Identity discovery is collection-wide; body readiness is limited to the selection. */
export async function readCandidateSelection(
  options: DecisionScanOptions,
  selector: string
) {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const decisionsDirectory = path.resolve(
    workspaceRoot,
    options.decisionsDir ?? "docs/decisions"
  );
  await ensureDecisionDirectoryPath(workspaceRoot, decisionsDirectory);
  const filesystem = await readFilesystemDecisionCandidates(
    decisionsDirectory,
    "decisions"
  );
  const published = await loadDecisionIndex({ decisionsDirectory });
  const matches = candidateMatches(filesystem, selector);
  const scanOptions = candidateScanOptions(
    filesystem,
    published.status === "ok" ? published.value : null
  );
  const { sourceErrors } = scanOptions;
  const records = await scanSourceFiles({
    ...scanOptions,
    sourceFiles: candidateSourceFiles(matches, decisionsDirectory)
  });
  const dependencies = new Set(
    records.flatMap((record) =>
      record.projection.relations.map((relation) => relation.target)
    )
  );
  await validateCandidateDependencies(
    dependencies,
    filesystem,
    decisionsDirectory,
    scanOptions
  );
  return { decisionsDirectory, records, sourceErrors };
}

export type CandidateIdentityContext = Readonly<{
  decisionsDirectory: string;
  records: readonly Readonly<{ decisionId: string; sourcePath: string }>[];
}>;

export async function loadCandidateIdentityContext(
  decisionsDirectory: string
): Promise<CandidateIdentityContext> {
  const directory = await fs.lstat(decisionsDirectory);
  if (!directory.isDirectory() || directory.isSymbolicLink())
    throw new Error(
      "Decision candidate directory must be a regular directory."
    );
  const filesystem = await readFilesystemDecisionCandidates(
    decisionsDirectory,
    "decisions"
  );
  const published = await loadDecisionIndex({ decisionsDirectory });
  return {
    decisionsDirectory,
    records: [
      ...[...filesystem.sources.values()].map(({ source }) => ({
        decisionId: source.decisionId,
        sourcePath: source.sourcePath
      })),
      ...(published.status === "ok"
        ? Object.entries(published.value.entries)
            .filter(([id]) => isDecisionId(id) && !filesystem.sources.has(id))
            .map(([decisionId, state]) => ({
              decisionId,
              sourcePath: state.sourcePath
            }))
        : [])
    ]
  };
}

function candidateMatches(
  filesystem: FilesystemDecisionCandidates,
  selector: string
) {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  const matches = [...filesystem.sources.values()].filter(({ source }) =>
    dated === null
      ? decisionNameFromId(source.decisionId) === normalized
      : source.decisionId === dated.id
  );
  if (
    matches.some(({ source }) =>
      filesystem.duplicateIds.has(source.decisionId)
    ) ||
    matches.length > 1
  )
    throw new Error(
      "Ambiguous Decision candidate selector: " +
        selector +
        "; choose one standard ID: " +
        matches
          .map(({ source }) => source.decisionId)
          .sort()
          .join(", ")
    );
  return matches;
}

type CandidateScanOptions = Readonly<{
  availableDecisionIds: ReadonlySet<DecisionId>;
  index: DecisionIndex | null;
  indexErrors: string[];
  indexRelativePath: string;
  sourceErrors: string[];
}>;
async function validateCandidateDependencies(
  dependencies: ReadonlySet<DecisionId>,
  filesystem: FilesystemDecisionCandidates,
  decisionsDirectory: string,
  scanOptions: CandidateScanOptions
): Promise<void> {
  const { sourceErrors } = scanOptions;
  for (const id of dependencies) {
    if (filesystem.duplicateIds.has(id)) {
      sourceErrors.push(
        "Direct candidate dependency has duplicate identity: " + id
      );
      continue;
    }
    const dependency = filesystem.sources.get(id)?.source;
    if (dependency === undefined) {
      sourceErrors.push("Direct candidate dependency is unavailable: " + id);
      continue;
    }
    await scanSourceFiles({
      ...scanOptions,
      sourceFiles: [
        {
          decisionId: id,
          decisionPath: path.join(decisionsDirectory, dependency.sourcePath),
          sourcePath: dependency.sourcePath,
          sourceText: dependency.text
        }
      ]
    });
  }
}

/** Convert discovered source identities and bytes to the scanner's source-file boundary. */
function candidateSourceFiles(
  matches: readonly DecisionStageSource[],
  decisionsDirectory: string
) {
  return matches.map(({ source }) => ({
    decisionId: source.decisionId,
    decisionPath: path.join(decisionsDirectory, source.sourcePath),
    sourcePath: source.sourcePath,
    sourceText: source.text
  }));
}

/** One scanner state is shared only by the selected candidate and its direct dependencies. */
function candidateScanOptions(
  filesystem: FilesystemDecisionCandidates,
  index: DecisionIndex | null
): CandidateScanOptions {
  const sourceErrors: string[] = [];
  const indexErrors: string[] = [];
  const availableDecisionIds = new Set([
    ...filesystem.sources.keys(),
    ...(index === null ? [] : Object.keys(index.entries).filter(isDecisionId))
  ]);
  return {
    availableDecisionIds,
    index,
    indexErrors,
    indexRelativePath: "decision-index.json",
    sourceErrors
  };
}
