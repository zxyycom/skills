/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-refresh-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-refresh-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-refresh-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
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
  workspace: DecisionIndex;
  head: DecisionIndex | null;
  pending: DecisionIndex | null;
  snapshot: PendingSnapshot;
  pendingIds: ReadonlyMap<DecisionId, ReadonlySet<string>>;
  selectedIds: readonly DecisionId[];
}>;

/** Captures the validated three-way projection and changed pending identity facts for one phase. */
export async function loadRefreshContext(
  options: RefreshOptions
): Promise<RefreshContext> {
  const { repository, decisionScope } = options.opened;
  await ensureDecisionDirectoryPath(
    repository.rootDirectory,
    options.decisionsDirectory
  );
  const indexPath = repositoryPath(decisionScope, decisionIndexFileName);
  const revision = await repository.getCurrentRevision();
  const workspaceText = decodeUtf8(
    await readStageFile(
      path.join(options.decisionsDirectory, decisionIndexFileName)
    ),
    decisionIndexFileName
  );
  const workspace = strictIndex(workspaceText, "workspace " + indexPath);
  const headFile =
    revision === null
      ? null
      : await repository.readRevisionFile(revision, indexPath);
  const head = headFile === null ? null : indexFromFile(headFile);
  compatible(head, workspace);

  const { snapshot, pending, pendingIds } = await captureRefreshPending(
    options,
    { head, workspace, revision, indexPath }
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
  return parsed.value;
}
function indexFromFile(file: VersionControlFile): DecisionIndex {
  if (file.kind !== "regular")
    throw new Error("Decision index must be a regular file: " + file.path);
  return strictIndex(decodeUtf8(file.data, file.path), file.path);
}
function compatible(
  index: DecisionIndex | null,
  workspace: DecisionIndex
): void {
  if (
    index !== null &&
    (!isDeepStrictEqual(index.metadata, workspace.metadata) ||
      index.sourceRevision.metadata !== workspace.sourceRevision.metadata ||
      index.definitionVersion !== workspace.definitionVersion)
  ) {
    throw new Error(
      "Decision stage index metadata is incompatible; handle the complete index explicitly."
    );
  }
}

/** Captures full pending identity while retaining only index and changed-source bytes. */
async function captureRefreshPending(
  options: RefreshOptions,
  baseline: Pick<
    RefreshContext,
    "head" | "workspace" | "revision" | "indexPath"
  >
) {
  const { repository, decisionScope } = options.opened;
  const { head, workspace, revision, indexPath } = baseline;
  // Only changed pending Markdown needs identity discovery; never rebuild HEAD Markdown.
  const initial =
    revision === null
      ? await readPendingSnapshot(repository, {
          pathScope: decisionScope,
          contentPaths: []
        })
      : null;
  const changed =
    revision === null
      ? initial!.members.map((file) => file.path)
      : await repository.listPendingChangedPaths({
          from: revision,
          pathScopes: [decisionScope]
        });
  const changedMarkdown = changed.filter((file) =>
    isDecisionSourcePath(decisionRelativePath(decisionScope, file))
  );
  const snapshot = await readPendingSnapshot(repository, {
    pathScope: decisionScope,
    contentPaths: [
      indexPath,
      ...(options.scope === "index" ? [] : changedMarkdown)
    ]
  });
  const pendingFile = snapshot.files.find((file) => file.path === indexPath);
  const pending =
    options.scope === "domain"
      ? null
      : pendingFile === undefined
        ? null
        : indexFromFile(pendingFile);
  if (options.scope !== "domain") {
    if (head !== null && pending === null)
      throw new Error(
        "Pending decision index was deleted; restore that deletion before stage index/all."
      );
    compatible(pending, workspace);
  }
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
