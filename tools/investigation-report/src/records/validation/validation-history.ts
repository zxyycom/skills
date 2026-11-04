import path from "node:path";
import { err, ok, type Result } from "neverthrow";
import {
  openVersionControl,
  repositoryRelativePathFromFileSystemPath,
  VersionControlError,
  type VersionControlRepository,
  type RevisionId
} from "../../../../shared/src/version-control/index.ts";
import {
  expectationOf,
  parseStateIndex
} from "../../../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName
} from "../../index/investigation-state-index.ts";
import { investigationIdFromMarkdown } from "../markdown.ts";
import { isInvestigationSourcePath } from "../../collection/report-path.ts";
import type { PublishedInvestigationIndex } from "../../publication/preparation/published-preparation.ts";
import type { InvestigationIndexState } from "../../types.ts";
import {
  renderInvestigationDiagnostic,
  type InvestigationDiagnostic,
  type InvestigationDiagnosticSource
} from "../../diagnostics.ts";
import {
  historicalInvestigationDiagnostic,
  historicalInvestigationErrorDiagnostic
} from "./validation-history-diagnostics.ts";

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
  if (recorded.status === "unavailable")
    return [
      renderInvestigationDiagnostic(recorded.diagnostic)
        .map((line) => line.trimStart())
        .join("; ")
    ];
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

type RecordedInvestigationIds =
  | Readonly<{ ids: ReadonlySet<string>; status: "available" }>
  | Readonly<{ status: "unavailable"; diagnostic: InvestigationDiagnostic }>;

async function recordedInvestigationIdsAtHead(
  investigationsDirectory: string,
  ids: Iterable<string>
): Promise<RecordedInvestigationIds | Readonly<{ status: "no-head" }>> {
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
    return await recordedInvestigationIdsAtRevision(
      { repository, revision, directoryScope },
      ids
    );
  } catch (error) {
    if (error instanceof VersionControlError && error.code === "not-repository")
      return { status: "no-head" };
    return {
      status: "unavailable",
      diagnostic: historicalInvestigationErrorDiagnostic(
        error,
        investigationsDirectory
      )
    };
  }
}

async function recordedInvestigationIdsAtRevision(
  context: HeadInvestigationContext,
  ids: Iterable<string>
): Promise<RecordedInvestigationIds> {
  const index = await readHeadInvestigationIndex(
    context.repository,
    context.revision,
    context.directoryScope
  );
  if (index.isErr()) return { status: "unavailable", diagnostic: index.error };
  if (index.value === null)
    return { ids: new Set<string>(), status: "available" };
  const recorded = await readRecordedPredecessors(context, index.value, ids);
  return recorded.isErr()
    ? { status: "unavailable", diagnostic: recorded.error }
    : { ids: recorded.value, status: "available" };
}

async function readHeadInvestigationIndex(
  repository: VersionControlRepository,
  revision: RevisionId,
  directoryScope: string
): Promise<
  Result<PublishedInvestigationIndex | null, InvestigationDiagnostic>
> {
  const indexPath =
    directoryScope.length === 0
      ? investigationIndexFileName
      : `${directoryScope}/${investigationIndexFileName}`;
  const context: InvestigationDiagnosticSource = {
    kind: "git-revision",
    path: indexPath,
    revision
  };
  const source = await repository.readRevisionFile(revision, indexPath);
  if (source === null)
    return await missingHistoricalInvestigationIndex(
      { repository, revision, directoryScope },
      context
    );
  if (source.kind !== "regular" && source.kind !== "executable")
    return err(
      historicalInvestigationDiagnostic(context, [
        {
          code: "investigation-report.history-index-type-invalid",
          detail: "historical investigation index must be an ordinary file"
        }
      ])
    );
  return parseHistoricalInvestigationIndex(
    Buffer.from(source.data).toString("utf8"),
    context
  );
}

async function missingHistoricalInvestigationIndex(
  { repository, revision, directoryScope }: HeadInvestigationContext,
  source: InvestigationDiagnosticSource
): Promise<Result<null, InvestigationDiagnostic>> {
  const paths = await headFormalSourcePaths(
    repository,
    revision,
    directoryScope
  );
  return paths.length === 0
    ? ok(null)
    : err(
        historicalInvestigationDiagnostic(source, [
          {
            code: "investigation-report.history-index-missing",
            detail:
              "historical investigation index is missing for existing reports"
          }
        ])
      );
}

function parseHistoricalInvestigationIndex(
  text: string,
  context: InvestigationDiagnosticSource
): Result<PublishedInvestigationIndex, InvestigationDiagnostic> {
  const definition = createInvestigationStateIndexDefinition();
  const loaded = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    sourcePath: context.path,
    text
  });
  if (loaded.status === "error")
    return err(
      historicalInvestigationDiagnostic(
        context,
        loaded.diagnostics.map(({ code, message, stateId }) => ({
          code,
          detail: message,
          ...(stateId === null ? {} : { stateId })
        }))
      )
    );
  return ok(loaded.value);
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
): Promise<Result<ReadonlySet<string>, InvestigationDiagnostic>> {
  const selected = [...new Set(ids)].flatMap((id) => {
    const state = index.entries[id];
    if (state === undefined) return [];
    const target =
      directoryScope.length === 0
        ? state.sourcePath
        : `${directoryScope}/${state.sourcePath}`;
    return [{ id, target }];
  });
  const reads =
    repository.prepareRevisionFileReads === undefined
      ? selected.map(
          ({ target }) =>
            () =>
              repository.readRevisionFile(revision, target)
        )
      : await repository.prepareRevisionFileReads(
          revision,
          selected.map(({ target }) => target)
        );
  const recorded = new Set<string>();
  for (const [offset, { id, target }] of selected.entries()) {
    const file = await reads[offset]!();
    if (
      file === null ||
      (file.kind !== "regular" && file.kind !== "executable") ||
      investigationIdFromMarkdown(Buffer.from(file.data).toString("utf8")) !==
        id
    )
      return err(
        historicalInvestigationDiagnostic(
          { kind: "git-revision", path: target, revision },
          [
            {
              code: "investigation-report.history-identity-unavailable",
              detail:
                "historical selected Investigation identity is unavailable",
              stateId: id
            }
          ]
        )
      );
    recorded.add(id);
  }
  return ok(recorded);
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
