import path from "node:path";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError,
  type VersionControlRepository,
  type RevisionId
} from "../../shared/src/version-control/index.ts";
import {
  expectationOf,
  parseStateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName
} from "./investigation-state-index.ts";
import { investigationIdFromMarkdown } from "./markdown.ts";
import { isInvestigationSourcePath } from "./report-path.ts";
import type { PublishedInvestigationIndex } from "./published-preparation.ts";
import type { InvestigationIndexState } from "./types.ts";

export async function unrecordedPredecessorWarnings(
  investigationsDirectory: string,
  states: ReadonlyMap<string, InvestigationIndexState>
): Promise<string[]> {
  const directPredecessors = [...states].flatMap(([source, state]) =>
    state.relations.map((relation) => ({ relation, source }))
  );
  if (directPredecessors.length === 0) return [];
  const recorded = await recordedInvestigationIdsAtHead(
    investigationsDirectory,
    new Set(directPredecessors.map(({ relation }) => relation.target))
  );
  if (recorded.status === "unavailable") return [recorded.warning];
  if (recorded.status === "no-head") return [];
  return uniqueSorted(
    directPredecessors
      .filter(({ relation }) => !recorded.ids.has(relation.target))
      .map(
        ({ relation, source }) =>
          `前序报告 ${relation.target} 尚未进入 Git HEAD，请确认 ${source} 的 ${relation.type} 关系是否应保留为独立调查演进。`
      )
  );
}

async function recordedInvestigationIdsAtHead(
  investigationsDirectory: string,
  ids: Iterable<string>
): Promise<
  | { ids: Set<string>; status: "available" }
  | { status: "no-head" }
  | { status: "unavailable"; warning: string }
> {
  try {
    const repository = await openVersionControl(investigationsDirectory);
    const revision = await repository.getCurrentRevision();
    if (revision === null) return { status: "no-head" };
    const directoryScope =
      path.resolve(investigationsDirectory) === repository.rootDirectory
        ? ""
        : repositoryRelativePathFromFileSystemPath(
            repository.rootDirectory,
            investigationsDirectory
          );
    const index = await readHeadInvestigationIndex(
      repository,
      revision,
      directoryScope
    );
    const recorded =
      index === null
        ? new Set<string>()
        : await readRecordedPredecessors(
            { repository, revision, directoryScope },
            index,
            ids
          );
    return { ids: recorded, status: "available" };
  } catch (error) {
    if (error instanceof VersionControlError && error.code === "not-repository")
      return { status: "no-head" };
    return {
      status: "unavailable",
      warning: historyCheckUnavailableWarning(investigationsDirectory, error)
    };
  }
}

async function readHeadInvestigationIndex(
  repository: VersionControlRepository,
  revision: RevisionId,
  directoryScope: string
): Promise<PublishedInvestigationIndex | null> {
  const indexPath =
    directoryScope.length === 0
      ? investigationIndexFileName
      : `${directoryScope}/${investigationIndexFileName}`;
  const source = await repository.readRevisionFile(revision, indexPath);
  if (source === null) {
    const paths = await headFormalSourcePaths(
      repository,
      revision,
      directoryScope
    );
    if (paths.length > 0)
      throw new Error(
        "historical investigation index is missing for existing reports; recover the historical baseline before relying on predecessor warnings"
      );
    return null;
  }
  if (source.kind !== "regular" && source.kind !== "executable")
    throw new Error("historical investigation index must be an ordinary file");
  const definition = createInvestigationStateIndexDefinition();
  const loaded = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    sourcePath: indexPath,
    text: Buffer.from(source.data).toString("utf8")
  });
  if (loaded.status === "error")
    throw new Error(
      "historical investigation index is invalid; recover the historical baseline"
    );
  return loaded.value;
}

type HeadInvestigationContext = Readonly<{
  repository: VersionControlRepository;
  revision: RevisionId;
  directoryScope: string;
}>;

async function readRecordedPredecessors(
  { repository, revision, directoryScope }: HeadInvestigationContext,
  index: PublishedInvestigationIndex,
  ids: Iterable<string>
): Promise<Set<string>> {
  const recorded = new Set<string>();
  for (const id of new Set(ids)) {
    const state = index.entries[id];
    if (state === undefined) continue;
    const target =
      directoryScope.length === 0
        ? state.sourcePath
        : `${directoryScope}/${state.sourcePath}`;
    const file = await repository.readRevisionFile(revision, target);
    if (
      file === null ||
      (file.kind !== "regular" && file.kind !== "executable") ||
      investigationIdFromMarkdown(Buffer.from(file.data).toString("utf8")) !==
        id
    )
      throw new Error(
        "historical selected Investigation identity is unavailable: " + id
      );
    recorded.add(id);
  }
  return recorded;
}

function historyCheckUnavailableWarning(
  investigationsDirectory: string,
  error: unknown
): string {
  const fields =
    error instanceof VersionControlError
      ? [
          `causeCategory: ${error.causeCategory}`,
          ...(error.operation === null
            ? []
            : [`operation: ${error.operation}`]),
          ...(error.detail === null ? [] : [`detail: ${error.detail}`])
        ]
      : operationErrorDetail(error) === null
        ? []
        : [`detail: ${operationErrorDetail(error)}`];
  return [
    "[investigation-report.history-check-unavailable]",
    `target: ${investigationsDirectory}`,
    "reason: the Git HEAD predecessor check could not be completed",
    "next: restore version-control access, then rerun the full check before relying on predecessor warnings",
    ...fields
  ].join("; ");
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  );
}

async function headFormalSourcePaths(
  repository: VersionControlRepository,
  revision: RevisionId,
  directoryScope: string
): Promise<string[]> {
  const revisionFiles =
    directoryScope.length === 0
      ? await repository.listRevisionFiles(revision)
      : await repository.listRevisionFiles(revision, {
          pathScopes: [directoryScope]
        });
  const sourcePaths = revisionFiles.filter((filePath) => {
    const sourcePath =
      directoryScope.length === 0
        ? filePath
        : filePath.slice(directoryScope.length + 1);
    return isInvestigationSourcePath(sourcePath);
  });
  return sourcePaths;
}
