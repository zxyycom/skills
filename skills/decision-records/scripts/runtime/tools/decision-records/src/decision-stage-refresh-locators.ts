/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-refresh-locators.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-refresh-locators.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-refresh-locators.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  readPendingSnapshot,
  extendsPendingSnapshot,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import { createDecisionNameLookup } from "./decision-record-lookup.ts";
import {
  isDecisionId,
  isDecisionSourcePath,
  parseDatedDecisionId
} from "./decision-path.ts";
import { indexFromFile } from "./decision-stage-refresh-index.ts";
import {
  decisionRelativePath,
  repositoryPath
} from "./decision-stage-support.ts";
import type {
  RefreshContext,
  RefreshOptions
} from "./decision-stage-refresh-context.ts";
import type { DecisionId, DecisionIndex } from "./types.ts";

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
  return options.selectors.some(
    (selector) =>
      ![baseline.head, baseline.workspace].some((index) =>
        indexContainsSelector(index, selector)
      ) &&
      !metadata.members.some((member) =>
        canonicalMatchesSelector(
          options.opened.decisionScope,
          member.path,
          selector
        )
      )
  );
}

function indexContainsSelector(
  index: DecisionIndex | null,
  selector: string
): boolean {
  const dated = parseDatedDecisionId(selector);
  return Object.entries(index?.entries ?? {}).some(([id, state]) =>
    dated === null ? state.name === selector : id === selector
  );
}

function canonicalMatchesSelector(
  scope: string,
  file: string,
  selector: string
): boolean {
  const basename = pendingBasename(scope, file);
  if (basename === null) return false;
  return (
    selector === basename ||
    (parseDatedDecisionId(selector) === null &&
      parseDatedDecisionId(basename)?.name === selector)
  );
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
  for (const member of locator.snapshot.members) {
    const basename = pendingBasename(options.opened.decisionScope, member.path);
    if (
      basename !== null &&
      selectedPendingBasename(basename, options.selectors, selected, names)
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
  selectors: readonly DecisionId[],
  selected: ReadonlySet<DecisionId>,
  names: ReadonlyMap<string, readonly DecisionId[]>
): boolean {
  if (selected.has(basename as DecisionId)) return true;
  const dated = parseDatedDecisionId(basename);
  return selectors.some(
    (selector) =>
      selector === basename ||
      (!names.get(selector)?.length && selector === dated?.name)
  );
}
