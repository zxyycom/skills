import {
  readRecordStagePending,
  sameRecordStagePendingIndex
} from "../../index-runtime/src/record-staging.ts";
import path from "node:path";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import {
  expectationOf,
  parseStateIndex,
  type StateIndexDefinition
} from "../../index-runtime/src/index.ts";
import {
  readPendingSnapshot,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import { investigationIdFromMarkdown } from "./markdown.ts";
import { isInvestigationSourcePath } from "./report-path.ts";
import {
  decodeUtf8,
  type DomainStageControl
} from "./staging-domain-support.ts";
import type {
  DomainRepository,
  DomainSnapshot
} from "./staging-domain-context.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState
} from "./types.ts";

export type DomainPendingFacts = Readonly<{
  pending: PendingSnapshot;
  pendingIndex: DomainSnapshot["pendingIndex"];
  pendingReportPaths: ReadonlyMap<string, readonly string[]>;
}>;

/** Only changed pending formal documents contribute extra identity/old-location facts. */
export async function readDomainPending(
  domain: DomainRepository,
  baseline: Pick<DomainSnapshot, "baseline" | "revision">,
  definition: StateIndexDefinition<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >,
  control: DomainStageControl,
  options: Readonly<{
    contentPaths?: readonly string[];
    previous?: Pick<DomainSnapshot, "pending" | "pendingIndex">;
  }> = {}
): Promise<DomainPendingFacts> {
  const { contentPaths = [], previous } = options;
  const reportPaths = await changedPendingReportPaths(
    domain,
    baseline,
    control
  );
  const pending = await readRecordStagePending(domain.repository, {
    scope: control.input.scope,
    indexPath: domain.repositoryIndexPath,
    pathScope: domain.investigationsScope,
    contentPaths: [...reportPaths, domain.repositoryIndexPath, ...contentPaths]
  });
  const pendingIndex =
    previous !== undefined &&
    sameRecordStagePendingIndex(
      previous.pending,
      pending,
      domain.repositoryIndexPath
    )
      ? previous.pendingIndex
      : parseDomainPendingIndex(
          pending,
          baseline.baseline,
          domain.repositoryIndexPath,
          definition,
          control.input.scope
        );
  const pendingReportPaths = pendingReportOwnership(pending.files, reportPaths);
  return { pending, pendingIndex, pendingReportPaths };
}

async function changedPendingReportPaths(
  domain: DomainRepository,
  baseline: Pick<DomainSnapshot, "revision">,
  control: DomainStageControl
): Promise<readonly string[]> {
  const changed =
    control.input.scope === "index"
      ? []
      : baseline.revision === null
        ? (
            await readPendingSnapshot(domain.repository, {
              pathScope: domain.investigationsScope,
              contentPaths: []
            })
          ).members.map((file) => file.path)
        : await domain.repository.listPendingChangedPaths({
            from: baseline.revision,
            pathScopes: [domain.investigationsScope]
          });
  const reportPaths = changed.filter((file) =>
    isInvestigationSourcePath(
      path.posix.relative(domain.investigationsScope, file)
    )
  );
  return reportPaths;
}

function parseDomainPendingIndex(
  pending: PendingSnapshot,
  baseline: DomainSnapshot["baseline"],
  indexPath: string,
  definition: StateIndexDefinition<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >,
  scope: "all" | "domain" | "index"
): DomainSnapshot["pendingIndex"] {
  const indexFile = pending.files.find((file) => file.path === indexPath);
  let pendingIndex: DomainSnapshot["pendingIndex"] = null;
  if (scope !== "domain") {
    if (indexFile === undefined && baseline !== null)
      throw new Error(
        "The pending index was deleted; restore that deletion before selective stage"
      );
    if (indexFile !== undefined) {
      if (indexFile.kind === "symlink")
        throw new Error("The pending index must be an ordinary file");
      const parsed = parseStateIndex({
        definition,
        expectation: expectationOf(definition),
        sourcePath: indexPath,
        text: decodeUtf8(indexFile.data)
      });
      if (parsed.status === "error")
        throw new Error(
          parsed.diagnostics.map((item) => item.message).join("; ")
        );
      pendingIndex = parsed.value;
    }
  }
  return pendingIndex;
}

function pendingReportOwnership(
  files: readonly VersionControlFile[],
  reportPaths: readonly string[]
): ReadonlyMap<string, readonly string[]> {
  const pendingReportPaths = new Map<string, string[]>();
  const formalPaths = new Set(reportPaths);
  for (const file of files) {
    if (!formalPaths.has(file.path)) continue;
    if (file.kind !== "regular" && file.kind !== "executable")
      throw new Error(
        `Cannot determine pending report ownership: ${file.path}`
      );
    const id = investigationIdFromMarkdown(decodeUtf8(file.data));
    if (id === null)
      throw new Error(`Cannot determine pending report identity: ${file.path}`);
    const paths = pendingReportPaths.get(id) ?? [];
    paths.push(file.path);
    pendingReportPaths.set(id, paths);
  }
  return pendingReportPaths;
}
