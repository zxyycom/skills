/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/staging/refresh/decision-stage-refresh-locators.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/staging/refresh/decision-stage-refresh-locators.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/staging/refresh/decision-stage-refresh-locators.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  readPendingSnapshot,
  extendsPendingSnapshot,
  type PendingSnapshot
} from "../../../../shared/src/version-control/pending-snapshot.ts";
import { createDecisionNameLookup } from "../../records/decision-record-lookup.ts";
import {
  isDecisionId,
  isDecisionSourcePath,
  parseDatedDecisionId
} from "../../collection/decision-path.ts";
import { indexFromFile } from "./decision-stage-refresh-index.ts";
import {
  decisionRelativePath,
  repositoryPath
} from "../decision-stage-support.ts";
import type {
  RefreshContext,
  RefreshOptions
} from "./decision-stage-refresh-context.ts";
import type { DecisionId, DecisionIndex } from "../../types.ts";

export type RefreshPendingBaseline = Pick<
  RefreshContext,
  "indexPath" | "head" | "workspace"
>;
export type RefreshPendingLocator = Readonly<{
  snapshot: PendingSnapshot;
  index: DecisionIndex | null;
  consumeIndex: boolean;
}>;

/** Identity selection and old-location discovery are independent; P may name a third selected path. */
export async function captureRefreshLocator(
  options: RefreshOptions,
  baseline: RefreshPendingBaseline,
  metadata: PendingSnapshot
): Promise<RefreshPendingLocator> {
  const required = pendingLocatorRequired(options, baseline, metadata);
  const snapshot = await readLocatorSnapshot(
    options,
    baseline.indexPath,
    metadata,
    required
  );
  if (!extendsPendingSnapshot(metadata, snapshot))
    throw new Error(
      "pending-conflict: Pending Decision snapshot changed during locator acquisition."
    );
  const file = snapshot.files.find((file) => file.path === baseline.indexPath);
  const index = parseLocatorIndex(options, file, required);
  return {
    snapshot,
    index,
    consumeIndex: options.scope !== "domain" || file !== undefined
  };
}

function pendingLocatorRequired(
  options: RefreshOptions,
  baseline: RefreshPendingBaseline,
  metadata: PendingSnapshot
): boolean {
  if (options.scope !== "domain") return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const index of [baseline.head, baseline.workspace])
    for (const [id, state] of Object.entries(index?.entries ?? {})) {
      ids.add(id);
      names.add(state.name);
    }
  const basenames = new Set<string>();
  const basenameNames = new Set<string>();
  for (const member of metadata.members) {
    const basename = pendingBasename(options.opened.decisionScope, member.path);
    if (basename === null) continue;
    basenames.add(basename);
    const dated = parseDatedDecisionId(basename);
    if (dated !== null) basenameNames.add(dated.name);
  }
  return options.selectors.some((selector) => {
    const dated = parseDatedDecisionId(selector);
    return (
      !(dated === null ? names.has(selector) : ids.has(selector)) &&
      !basenames.has(selector) &&
      !(dated === null && basenameNames.has(selector))
    );
  });
}

async function readLocatorSnapshot(
  options: RefreshOptions,
  indexPath: string,
  metadata: PendingSnapshot,
  required: boolean
): Promise<PendingSnapshot> {
  if (
    options.scope !== "domain" ||
    !metadata.members.some((member) => member.path === indexPath)
  )
    return metadata;
  try {
    return await readPendingSnapshot(options.opened.repository, {
      pathScope: options.opened.decisionScope,
      contentPaths: [indexPath],
      payloadScope: "content-paths"
    });
  } catch (error) {
    if (required) throw error;
    // Only optional P index acquisition may fail; later selected payload reads remain mandatory.
    return metadata;
  }
}

function parseLocatorIndex(
  options: RefreshOptions,
  file: PendingSnapshot["files"][number] | undefined,
  required: boolean
): DecisionIndex | null {
  if (file === undefined) return null;
  try {
    return indexFromFile(file);
  } catch (error) {
    if (options.scope !== "domain" || required) throw error;
    return null;
  }
}

export function selectedPendingPaths(
  options: RefreshOptions,
  baseline: RefreshPendingBaseline,
  locator: RefreshPendingLocator
): Readonly<{
  selected: ReadonlySet<DecisionId>;
  contentPaths: readonly string[];
}> {
  const indexes = [baseline.head, baseline.workspace, locator.index];
  const { names, selected } = pendingLocatorSelection(
    indexes,
    options.selectors
  );
  const paths = new Set(locator.consumeIndex ? [baseline.indexPath] : []);
  addIndexedPendingPaths(
    options.opened.decisionScope,
    indexes,
    selected,
    paths
  );
  const selectorSet = new Set(options.selectors);
  for (const member of locator.snapshot.members) {
    const basename = pendingBasename(options.opened.decisionScope, member.path);
    if (
      basename !== null &&
      selectedPendingBasename(basename, selectorSet, selected, names)
    )
      paths.add(member.path);
  }
  return { selected, contentPaths: [...paths] };
}

function pendingLocatorSelection(
  indexes: readonly (DecisionIndex | null)[],
  selectors: readonly DecisionId[]
) {
  const ids = new Set(
    indexes
      .flatMap((index) => Object.keys(index?.entries ?? {}))
      .filter(isDecisionId)
  );
  const names = createDecisionNameLookup(ids);
  const selected = new Set(
    selectors.flatMap((selector) =>
      parseDatedDecisionId(selector) !== null
        ? [selector]
        : [...(names.get(selector) ?? [])]
    )
  );
  return { names, selected };
}

function addIndexedPendingPaths(
  scope: string,
  indexes: readonly (DecisionIndex | null)[],
  selected: ReadonlySet<DecisionId>,
  paths: Set<string>
): void {
  for (const index of indexes)
    for (const id of selected) {
      const entry = index?.entries[id];
      if (entry !== undefined)
        paths.add(repositoryPath(scope, entry.sourcePath));
    }
}

function pendingBasename(scope: string, file: string): string | null {
  const relative = decisionRelativePath(scope, file);
  if (!isDecisionSourcePath(relative)) return null;
  return relative.replace(/^archive\//, "").replace(/\.md$/, "");
}

function selectedPendingBasename(
  basename: string,
  selectors: ReadonlySet<DecisionId>,
  selected: ReadonlySet<DecisionId>,
  names: ReadonlyMap<string, readonly DecisionId[]>
): boolean {
  if (selected.has(basename as DecisionId)) return true;
  const dated = parseDatedDecisionId(basename);
  return (
    selectors.has(basename as DecisionId) ||
    (dated !== null &&
      selectors.has(dated.name as DecisionId) &&
      !names.get(dated.name)?.length)
  );
}
