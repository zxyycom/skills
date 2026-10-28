/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-pending.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-pending.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-pending.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { investigationNameFromId } from "./report-path.ts";
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
  extendsPendingSnapshot,
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
  options: DomainPendingReadOptions = {}
): Promise<DomainPendingFacts> {
  const { contentPaths = [], previous } = options;
  const { locatorPending, locatorIndex, canonicalPaths } =
    await discoverDomainPendingLocators(
      domain,
      baseline,
      definition,
      control,
      options
    );
  const reportPaths = selectedPendingReportPaths(
    domain,
    locatorIndex,
    control.input.reportIds,
    contentPaths,
    canonicalPaths
  );
  const pending = await readRecordStagePending(domain.repository, {
    scope: control.input.scope,
    indexPath: domain.repositoryIndexPath,
    pathScope: domain.investigationsScope,
    contentPaths: [
      ...reportPaths,
      ...(control.input.scope !== "domain" || locatorPending !== null
        ? [domain.repositoryIndexPath]
        : []),
      ...contentPaths
    ]
  });
  if (
    locatorPending !== null &&
    !extendsPendingSnapshot(locatorPending, pending)
  )
    throw new Error(
      "The pending index changed during selected locator acquisition"
    );
  const pendingIndex = pendingProjection(pending, previous, {
    scope: control.input.scope,
    locatorIndex,
    indexPath: domain.repositoryIndexPath,
    baseline: baseline.baseline,
    definition
  });
  const pendingReportPaths = pendingReportOwnership(pending.files, reportPaths);
  return { pending, pendingIndex, pendingReportPaths };
}

function selectedPendingReportPaths(
  domain: DomainRepository,
  locatorIndex: DomainSnapshot["pendingIndex"],
  selectors: readonly string[],
  contentPaths: readonly string[],
  canonicalPaths: readonly string[]
): string[] {
  const selected = new Set(selectors);
  return [
    ...new Set([
      ...Object.entries(locatorIndex?.entries ?? {})
        .filter(
          ([id]) =>
            selected.has(id) || selected.has(investigationNameFromId(id))
        )
        .map(([, state]) =>
          path.posix.join(domain.investigationsScope, state.sourcePath)
        ),
      ...contentPaths.filter((file) =>
        isInvestigationSourcePath(
          path.posix.relative(domain.investigationsScope, file)
        )
      ),
      ...canonicalPaths
    ])
  ];
}

type DomainPendingReadOptions = Readonly<{
  contentPaths?: readonly string[];
  workspaceIndex?: DomainSnapshot["workspaceIndex"];
  previous?: Pick<DomainSnapshot, "pending" | "pendingIndex">;
}>;

type DomainPendingDefinition = StateIndexDefinition<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

type DomainPendingLocators = Readonly<{
  locatorPending: PendingSnapshot | null;
  locatorIndex: DomainSnapshot["pendingIndex"];
  canonicalPaths: readonly string[];
}>;

async function discoverDomainPendingLocators(
  domain: DomainRepository,
  baseline: Pick<DomainSnapshot, "baseline" | "revision">,
  definition: DomainPendingDefinition,
  control: DomainStageControl,
  options: DomainPendingReadOptions
): Promise<DomainPendingLocators> {
  const metadata =
    control.input.scope === "index"
      ? null
      : await readPendingSnapshot(domain.repository, {
          pathScope: domain.investigationsScope,
          contentPaths: [],
          payloadScope: "content-paths"
        });
  const canonicalPaths = selectedCanonicalPendingPaths(
    domain,
    metadata,
    control
  );
  const needsPendingLocator =
    control.input.scope === "domain" &&
    requiresPendingLocator(
      control.input.reportIds,
      [baseline.baseline, options.workspaceIndex],
      canonicalPaths
    );
  const locators =
    control.input.scope === "domain" &&
    metadata?.members.some(
      (member) => member.path === domain.repositoryIndexPath
    )
      ? await readDomainLocatorIndex(
          domain,
          baseline.baseline,
          definition,
          control,
          needsPendingLocator
        )
      : { locatorPending: null, locatorIndex: null };
  return { ...locators, canonicalPaths };
}

function selectedCanonicalPendingPaths(
  domain: DomainRepository,
  metadata: PendingSnapshot | null,
  control: DomainStageControl
): string[] {
  const selected = new Set(control.input.reportIds);
  return (metadata?.members ?? [])
    .filter((member) => {
      const relative = path.posix.relative(
        domain.investigationsScope,
        member.path
      );
      if (!isInvestigationSourcePath(relative)) return false;
      const locator = relative.slice(0, -3);
      return (
        selected.has(locator) || selected.has(investigationNameFromId(locator))
      );
    })
    .map((member) => member.path);
}

function requiresPendingLocator(
  selectors: readonly string[],
  indexes: readonly (DomainSnapshot["baseline"] | undefined)[],
  canonicalPaths: readonly string[]
): boolean {
  const known = new Set<string>();
  for (const index of indexes) {
    for (const id of Object.keys(index?.entries ?? {})) {
      known.add(id);
      known.add(investigationNameFromId(id));
    }
  }
  for (const sourcePath of canonicalPaths) {
    const locator = path.posix.basename(sourcePath, ".md");
    known.add(locator);
    known.add(investigationNameFromId(locator));
  }
  return selectors.some((selector) => !known.has(selector));
}

async function readDomainLocatorIndex(
  domain: DomainRepository,
  baseline: DomainSnapshot["baseline"],
  definition: DomainPendingDefinition,
  control: DomainStageControl,
  required: boolean
): Promise<Pick<DomainPendingLocators, "locatorPending" | "locatorIndex">> {
  let locatorPending: PendingSnapshot | null = null;
  let locatorIndex: DomainSnapshot["pendingIndex"] = null;
  // Only index acquisition/parsing is optional; selected source failures propagate later.
  try {
    locatorPending = await readRecordStagePending(domain.repository, {
      scope: control.input.scope,
      indexPath: domain.repositoryIndexPath,
      pathScope: domain.investigationsScope,
      contentPaths: [domain.repositoryIndexPath]
    });
    locatorIndex = parseDomainPendingIndex(locatorPending, definition, {
      baseline,
      indexPath: domain.repositoryIndexPath,
      scope: "domain"
    });
  } catch (error) {
    if (required) throw error;
  }
  return { locatorPending, locatorIndex };
}

function pendingProjection(
  pending: PendingSnapshot,
  previous: DomainPendingReadOptions["previous"],
  options: DomainPendingProjection &
    Readonly<{
      locatorIndex: DomainSnapshot["pendingIndex"];
      definition: DomainPendingDefinition;
    }>
): DomainSnapshot["pendingIndex"] {
  if (options.scope === "domain") return options.locatorIndex;
  if (
    previous !== undefined &&
    sameRecordStagePendingIndex(previous.pending, pending, options.indexPath)
  )
    return previous.pendingIndex;
  return parseDomainPendingIndex(pending, options.definition, options);
}

type DomainPendingProjection = Readonly<{
  baseline: DomainSnapshot["baseline"];
  indexPath: string;
  scope: "all" | "domain" | "index";
}>;

function parseDomainPendingIndex(
  pending: PendingSnapshot,
  definition: DomainPendingDefinition,
  options: DomainPendingProjection
): DomainSnapshot["pendingIndex"] {
  const indexFile = pending.files.find(
    (file) => file.path === options.indexPath
  );
  if (
    indexFile === undefined &&
    options.baseline !== null &&
    options.scope !== "domain"
  )
    throw new Error(
      "The pending index was deleted; restore that deletion before selective stage"
    );
  if (indexFile === undefined) return null;
  if (indexFile.kind === "symlink")
    throw new Error("The pending index must be an ordinary file");
  const parsed = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    sourcePath: options.indexPath,
    text: decodeUtf8(indexFile.data)
  });
  if (parsed.status === "error")
    throw new Error(parsed.diagnostics.map((item) => item.message).join("; "));
  return parsed.value;
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
