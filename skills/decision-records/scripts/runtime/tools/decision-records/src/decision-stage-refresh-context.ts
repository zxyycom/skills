/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-refresh-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-refresh-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-refresh-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { sameBytes } from "../../shared/src/node/bytes.ts";
import path from "node:path";
import {
  readRecordStagePending,
  sameRecordStagePendingIndex
} from "../../index-runtime/src/record-staging.ts";
import {
  readPendingSnapshot,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import type {
  RevisionId,
  VersionControlFile
} from "../../shared/src/version-control/index.ts";
import {
  decisionIndexFileName,
  parseDecisionIndex
} from "./decision-state-index.ts";
import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import { createDecisionNameLookup } from "./decision-record-lookup.ts";
import {
  isDecisionId,
  isDecisionSourcePath,
  parseDatedDecisionId
} from "./decision-path.ts";
import { stageSourceFromFile } from "./decision-stage-sources.ts";
import {
  decisionRelativePath,
  decodeUtf8,
  readStageFile,
  repositoryPath
} from "./decision-stage-support.ts";
import type { StageRepositoryContext } from "./decision-stage-repository.ts";
import type { DecisionId, DecisionIndex } from "./types.ts";
import type { DecisionStageScope } from "./decision-stage-contracts.ts";

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
    { revision, indexPath },
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

function strictIndex(text: string, label: string): DecisionIndex {
  const parsed = parseDecisionIndex(text, label);
  if (parsed.status === "error")
    throw new Error(
      label +
        ": " +
        parsed.diagnostics.map((item) => item.message).join("; ") +
        "; run check / sync-index for recovery."
    );
  return Object.freeze(parsed.value);
}
function indexFromFile(file: VersionControlFile): DecisionIndex {
  if (file.kind !== "regular")
    throw new Error("Decision index must be a regular file: " + file.path);
  return strictIndex(decodeUtf8(file.data, file.path), file.path);
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
  return { revision, head: file === null ? null : indexFromFile(file) };
}

/** Captures full pending identity while retaining only index and changed-source bytes. */
async function captureRefreshPending(
  options: RefreshOptions,
  baseline: Pick<RefreshContext, "revision" | "indexPath">,
  previous?: RefreshContext
) {
  const { repository, decisionScope } = options.opened;
  const { revision, indexPath } = baseline;
  // Only changed pending Markdown needs identity discovery; never rebuild HEAD Markdown.
  const initial =
    revision === null && options.scope !== "index"
      ? await readPendingSnapshot(repository, {
          pathScope: decisionScope,
          contentPaths: []
        })
      : null;
  const changed =
    options.scope === "index"
      ? []
      : revision === null
        ? initial!.members.map((file) => file.path)
        : await repository.listPendingChangedPaths({
            from: revision,
            pathScopes: [decisionScope]
          });
  const changedMarkdown = changed.filter((file) =>
    isDecisionSourcePath(decisionRelativePath(decisionScope, file))
  );
  const snapshot = await readRecordStagePending(repository, {
    scope: options.scope,
    indexPath,
    pathScope: decisionScope,
    contentPaths: [
      indexPath,
      ...(options.scope === "index" ? [] : changedMarkdown)
    ]
  });
  const pendingFile = snapshot.files.find((file) => file.path === indexPath);
  const pending =
    previous !== undefined &&
    sameRecordStagePendingIndex(previous.snapshot, snapshot, indexPath)
      ? previous.pending
      : options.scope === "domain"
        ? null
        : pendingFile === undefined
          ? null
          : indexFromFile(pendingFile);
  const pendingSources =
    options.scope === "index"
      ? []
      : snapshot.files
          .filter((file) => changedMarkdown.includes(file.path))
          .map((file) =>
            stageSourceFromFile(
              file,
              decisionRelativePath(decisionScope, file.path)
            )
          );
  const pendingIds = new Map<DecisionId, Set<string>>();
  for (const source of pendingSources) {
    const id = source.source.decisionId;
    const paths = pendingIds.get(id) ?? new Set<string>();
    paths.add(source.file.path);
    pendingIds.set(id, paths);
  }
  for (const [id, paths] of pendingIds)
    if (paths.size > 1)
      throw new Error("Conflicting pending Decision identity: " + id);
  return { snapshot, pending, pendingIds };
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
