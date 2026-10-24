import {
  readRecordStagePending,
  sameRecordStagePendingIndex
} from "../../index-runtime/src/record-staging.ts";
import {
  readPendingSnapshot,
  extendsPendingSnapshot,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import {
  captureRefreshLocator,
  selectedPendingPaths,
  type RefreshPendingBaseline
} from "./decision-stage-refresh-locators.ts";
import { indexFromFile } from "./decision-stage-refresh-index.ts";
import { stageSourceFromFile } from "./decision-stage-sources.ts";
import { decisionRelativePath } from "./decision-stage-support.ts";
import type {
  RefreshContext,
  RefreshOptions
} from "./decision-stage-refresh-context.ts";
import type { DecisionId, DecisionIndex } from "./types.ts";

type RefreshPendingFacts = Readonly<{
  snapshot: PendingSnapshot;
  pending: DecisionIndex | null;
  pendingIds: ReadonlyMap<DecisionId, ReadonlySet<string>>;
}>;

/** Capture full pending identity with only the scope's actual payload selection. */
export async function captureRefreshPending(
  options: RefreshOptions,
  baseline: RefreshPendingBaseline,
  previous?: RefreshContext
): Promise<RefreshPendingFacts> {
  if (options.scope === "index")
    return await capturePendingIndex(options, baseline.indexPath, previous);
  const metadata = await readPendingSnapshot(options.opened.repository, {
    pathScope: options.opened.decisionScope,
    contentPaths: options.scope === "domain" ? [] : [baseline.indexPath],
    payloadScope: "content-paths"
  });
  const locator = await captureRefreshLocator(options, baseline, metadata);
  const { selected, contentPaths } = selectedPendingPaths(
    options,
    baseline,
    locator
  );
  const snapshot = await readRecordStagePending(options.opened.repository, {
    scope: options.scope,
    indexPath: baseline.indexPath,
    pathScope: options.opened.decisionScope,
    contentPaths
  });
  // Outside the optional locator catch: every selected old payload must be readable and stable.
  if (!extendsPendingSnapshot(locator.snapshot, snapshot))
    throw new Error(
      "pending-conflict: Pending Decision snapshot changed during selection."
    );
  const pending = refreshedPendingIndex(
    options,
    baseline.indexPath,
    snapshot,
    locator.index,
    previous
  );
  const pendingIds = selectedPendingIdentities(
    options,
    baseline,
    snapshot,
    selected,
    locator.index
  );
  return { snapshot, pending, pendingIds };
}

async function capturePendingIndex(
  options: RefreshOptions,
  indexPath: string,
  previous?: RefreshContext
) {
  const snapshot = await readRecordStagePending(options.opened.repository, {
    scope: "index",
    indexPath,
    pathScope: options.opened.decisionScope,
    contentPaths: [indexPath]
  });
  return {
    snapshot,
    pending: refreshedPendingIndex(
      options,
      indexPath,
      snapshot,
      null,
      previous
    ),
    pendingIds: new Map<DecisionId, Set<string>>()
  };
}

function refreshedPendingIndex(
  options: RefreshOptions,
  indexPath: string,
  snapshot: PendingSnapshot,
  locatorIndex: DecisionIndex | null,
  previous?: RefreshContext
): DecisionIndex | null {
  if (
    previous !== undefined &&
    sameRecordStagePendingIndex(previous.snapshot, snapshot, indexPath)
  )
    return previous.pending;
  if (options.scope === "domain") return locatorIndex;
  const file = snapshot.files.find((file) => file.path === indexPath);
  return file === undefined ? null : indexFromFile(file);
}

function selectedPendingIdentities(
  options: RefreshOptions,
  baseline: RefreshPendingBaseline,
  snapshot: PendingSnapshot,
  selected: ReadonlySet<DecisionId>,
  locatorIndex: DecisionIndex | null
): Map<DecisionId, Set<string>> {
  const sources = snapshot.files
    .filter((file) => file.path !== baseline.indexPath)
    .map((file) =>
      stageSourceFromFile(
        file,
        decisionRelativePath(options.opened.decisionScope, file.path)
      )
    );
  for (const source of sources)
    verifyPendingLocatorIdentity(
      source,
      selected,
      locatorIndex,
      baseline.workspace
    );
  const pendingIds = new Map<DecisionId, Set<string>>();
  for (const source of sources) {
    const id = source.source.decisionId;
    const paths = pendingIds.get(id) ?? new Set<string>();
    paths.add(source.file.path);
    pendingIds.set(id, paths);
  }
  for (const [id, paths] of pendingIds)
    if (paths.size > 1)
      throw new Error("Conflicting pending Decision identity: " + id);
  return pendingIds;
}

function verifyPendingLocatorIdentity(
  source: ReturnType<typeof stageSourceFromFile>,
  selected: ReadonlySet<DecisionId>,
  locatorIndex: DecisionIndex | null,
  workspace: DecisionIndex
): void {
  const expected = Object.entries(locatorIndex?.entries ?? {}).find(
    ([id, entry]) =>
      selected.has(id as DecisionId) &&
      entry.sourcePath === source.source.sourcePath
  );
  if (expected === undefined || source.source.decisionId === expected[0])
    return;
  const current = workspace.entries[source.source.decisionId];
  if (
    selected.has(source.source.decisionId) &&
    current?.sourcePath === source.source.sourcePath
  )
    return;
  throw new Error(
    "Selected pending Decision identity differs from its published locator: " +
      source.source.sourcePath
  );
}
