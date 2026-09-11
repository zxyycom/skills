import path from "node:path";
import { operationErrorDetail } from "../../shared/src/version-control/error-detail.ts";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import { investigationIdFromMarkdown } from "./markdown.ts";
import { isInvestigationSourcePath } from "./report-path.ts";
import type { InvestigationIndexState } from "./types.ts";

export async function unrecordedPredecessorWarnings(
  investigationsDirectory: string,
  states: ReadonlyMap<string, InvestigationIndexState>
): Promise<string[]> {
  const directPredecessors = [...states].flatMap(([source, state]) =>
    state.relations.map((relation) => ({ relation, source }))
  );
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
    const files = await repository.readRevisionFiles(revision, {
      pathScopes: sourcePaths
    });
    const requested = new Set(ids);
    return {
      ids: new Set(
        files.flatMap((file) => {
          const sourcePath =
            directoryScope.length === 0
              ? file.path
              : file.path.slice(directoryScope.length + 1);
          const id =
            investigationIdFromMarkdown(
              Buffer.from(file.data).toString("utf8")
            ) ?? sourcePath.slice(0, -".md".length);
          return requested.has(id) ? [id] : [];
        })
      ),
      status: "available"
    };
  } catch (error) {
    if (error instanceof VersionControlError && error.code === "not-repository")
      return { status: "no-head" };
    return {
      status: "unavailable",
      warning: historyCheckUnavailableWarning(investigationsDirectory, error)
    };
  }
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
