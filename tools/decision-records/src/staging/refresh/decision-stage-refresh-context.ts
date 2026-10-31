import { sameBytes } from "../../../../shared/src/node/bytes.ts";
import path from "node:path";
import type { PendingSnapshot } from "../../../../shared/src/version-control/pending-snapshot.ts";
import { captureRefreshPending } from "./decision-stage-refresh-pending.ts";
import { strictIndex, indexFromFile } from "./decision-stage-refresh-index.ts";
import type { RevisionId } from "../../../../shared/src/version-control/index.ts";
import { decisionIndexFileName } from "../../index/decision-state-index.ts";
import { ensureDecisionDirectoryPath } from "../../sources/decision-source-path-safety.ts";
import { createDecisionNameLookup } from "../../records/decision-record-lookup.ts";
import {
  isDecisionId,
  isDecisionSourcePath,
  parseDatedDecisionId
} from "../../collection/decision-path.ts";
import {
  decodeUtf8,
  readStageFile,
  repositoryPath
} from "../decision-stage-support.ts";
import type { StageRepositoryContext } from "../decision-stage-repository.ts";
import type { DecisionId, DecisionIndex } from "../../types.ts";
import type { DecisionStageScope } from "../decision-stage-contracts.ts";

export type RefreshOptions = Readonly<{
  decisionsDirectory: string;
  workspaceRoot: string;
  opened: StageRepositoryContext;
  selectors: readonly DecisionId[];
  scope: DecisionStageScope;
}>;
export type RefreshContext = Readonly<{
  indexPath: string;
  revision: RevisionId | null;
  workspaceText: string;
  workspaceBytes: Uint8Array;
  workspace: DecisionIndex;
  head: DecisionIndex | null;
  pending: DecisionIndex | null;
  snapshot: PendingSnapshot;
  pendingIds: ReadonlyMap<DecisionId, ReadonlySet<string>>;
  selectedIds: readonly DecisionId[];
}>;

/** Captures the validated three-way projection and changed pending identity facts for one phase. */
export async function loadRefreshContext(
  options: RefreshOptions,
  fixed: Pick<RefreshContext, "head" | "revision">,
  previous?: RefreshContext
): Promise<RefreshContext> {
  const { repository, decisionScope } = options.opened;
  await ensureDecisionDirectoryPath(
    repository.rootDirectory,
    options.decisionsDirectory
  );
  const indexPath = repositoryPath(decisionScope, decisionIndexFileName);
  const { revision, head } = fixed;
  const workspaceBytes = await readStageFile(
    path.join(options.decisionsDirectory, decisionIndexFileName)
  );
  const workspaceText = decodeUtf8(workspaceBytes, decisionIndexFileName);
  const workspace =
    previous !== undefined && sameBytes(previous.workspaceBytes, workspaceBytes)
      ? previous.workspace
      : strictIndex(workspaceText, "workspace " + indexPath);
  const { snapshot, pending, pendingIds } = await captureRefreshPending(
    options,
    { indexPath, head, workspace },
    previous
  );
  const selectedIds = selectRefreshIds(
    options.selectors,
    [head, pending, workspace],
    pendingIds.keys()
  );
  return {
    indexPath,
    revision,
    workspaceText,
    workspaceBytes,
    workspace,
    head,
    pending,
    snapshot,
    pendingIds,
    selectedIds
  };
}

export async function loadRefreshBaseline(
  options: RefreshOptions
): Promise<Pick<RefreshContext, "head" | "revision">> {
  const { repository, decisionScope } = options.opened;
  const revision = await repository.getCurrentRevision();
  const file =
    revision === null
      ? null
      : await repository.readRevisionFile(
          revision,
          repositoryPath(decisionScope, decisionIndexFileName)
        );
  if (revision !== null && file === null) {
    const prefix = decisionScope + "/";
    const members = await repository.listRevisionFiles(revision, {
      pathScopes: [decisionScope]
    });
    if (
      members.some((member) =>
        isDecisionSourcePath(member.slice(prefix.length))
      )
    )
      throw new Error(
        "HEAD Decision index is missing for existing sources; restore a trusted historical index before staging."
      );
  }
  return { revision, head: file === null ? null : indexFromFile(file) };
}

/** Resolve the complete captured identity union before selecting any domain writes. */
function selectRefreshIds(
  selectors: readonly DecisionId[],
  indexes: readonly (DecisionIndex | null)[],
  pendingIds: Iterable<DecisionId>
): DecisionId[] {
  const ids = new Set([
    ...indexes.flatMap((index) => Object.keys(index?.entries ?? {})),
    ...pendingIds
  ]);
  const names = createDecisionNameLookup([...ids].filter(isDecisionId));
  const selectedIds = selectors.map((selector) => {
    const dated = parseDatedDecisionId(selector);
    const matches =
      dated === null
        ? (names.get(selector) ?? [])
        : ids.has(dated.id)
          ? [dated.id]
          : [];
    if (matches.length !== 1)
      throw new Error(
        "Decision stage selector is missing or ambiguous: " + selector
      );
    return matches[0]!;
  });
  if (new Set(selectedIds).size !== selectedIds.length)
    throw new Error("Repeated resolved Decision stage selector.");
  return selectedIds;
}
