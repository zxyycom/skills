/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { PendingSnapshot } from "../../shared/src/version-control/pending-snapshot.ts";
import { readDomainPending } from "./staging-pending.ts";
import path from "node:path";
import type {
  RevisionId,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  expectationOf,
  hasEntry,
  parseStateIndex
} from "../../index-runtime/src/index.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import {
  domainSourceSelection,
  type DomainSourceSelection
} from "./staging-domain-sources.ts";
import {
  loadDomainWorkspace,
  type DomainWorkspaceFacts
} from "./staging-domain-index.ts";
import { resolveInvestigationStageSelectors } from "./staging-selectors.ts";
import {
  compareText,
  decodeUtf8,
  stageDiagnostic,
  type DomainStageControl,
  type DomainStep,
  type InvestigationDomainStageInput,
  type InvestigationIndex
} from "./staging-domain-support.ts";
import {
  domainFailure,
  domainFailureDiagnostics
} from "./staging-domain-failures.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState
} from "./types.ts";

type CanonicalInvestigationIndexDefinition =
  DomainWorkspaceFacts["canonicalDefinition"];

export type DomainRepository = Readonly<{
  investigationsScope: string;
  repository: VersionControlRepository;
  repositoryIndexPath: string;
}>;

export type DomainSnapshot = DomainWorkspaceFacts &
  Readonly<{
    baseline: InvestigationIndex | null;
    pendingIndex: InvestigationIndex | null;
    pending: PendingSnapshot;
    pendingReportPaths: ReadonlyMap<string, readonly string[]>;
    revision: RevisionId | null;
  }>;

export type DomainSelection = Readonly<{
  selectedIds: readonly string[];
  sourceSelection: DomainSourceSelection;
}>;

export function domainStageControl(
  input: InvestigationDomainStageInput
): DomainStageControl {
  return {
    indexPath: path.join(
      input.investigationsDirectory,
      investigationIndexFileName
    ),
    input
  };
}

export async function openDomainRepository(
  control: DomainStageControl
): Promise<DomainStep<DomainRepository>> {
  let repository: Awaited<ReturnType<typeof openVersionControl>>;
  try {
    repository = await openVersionControl(
      control.input.investigationsDirectory
    );
  } catch (error) {
    return {
      status: "error",
      result: domainFailure(control, "repository-unavailable", error)
    };
  }
  const investigationsScope = repositoryScopePath(
    repository,
    control.input.investigationsDirectory
  );
  return {
    status: "ok",
    value: {
      investigationsScope,
      repository,
      repositoryIndexPath: path.posix.join(
        investigationsScope,
        investigationIndexFileName
      )
    }
  };
}

function repositoryScopePath(
  repository: VersionControlRepository,
  investigationsDirectory: string
): string {
  const relativePath = path.relative(
    repository.rootDirectory,
    investigationsDirectory
  );
  if (
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep)
  ) {
    throw new Error(
      `Investigation directory must be inside, and below the root of, its version-controlled repository: ${investigationsDirectory}`
    );
  }
  return relativePath.split(path.sep).join("/");
}

/** Loads validated HEAD/workspace projections and this transaction's pending facts. */
export async function loadDomainSnapshot(
  domain: DomainRepository,
  control: DomainStageControl,
  fixed?: Pick<DomainSnapshot, "baseline" | "revision"> &
    Readonly<{ contentPaths?: readonly string[]; previous?: DomainSnapshot }>
): Promise<DomainStep<DomainSnapshot>> {
  const workspace = await loadDomainWorkspace(
    control,
    fixed?.previous,
    fixed === undefined ? "prepare" : "verify"
  );
  if (workspace.status === "error") return workspace;
  const { canonicalDefinition } = workspace.value;
  const baseline: BaselineOutcome =
    fixed === undefined
      ? await domainBaselineIndex(domain, canonicalDefinition, control)
      : { status: "ok", value: fixed };
  if (baseline.status === "error") return baseline;
  let pendingFacts: Awaited<ReturnType<typeof readDomainPending>>;
  try {
    pendingFacts = await readDomainPending(
      domain,
      baseline.value,
      canonicalDefinition,
      control,
      { contentPaths: fixed?.contentPaths, previous: fixed?.previous }
    );
  } catch (error) {
    return {
      status: "error",
      result: domainFailure(control, "pending-read-failed", error)
    };
  }
  return {
    status: "ok",
    value: {
      ...pendingFacts,
      baseline: baseline.value.baseline,
      revision: baseline.value.revision,
      ...workspace.value
    }
  };
}

type DomainBaseline = Readonly<{
  baseline: InvestigationIndex | null;
  revision: RevisionId | null;
}>;

type BaselineOutcome = DomainStep<DomainBaseline>;

type ParsedBaselineIndex = ReturnType<
  typeof parseStateIndex<InvestigationIndexState, InvestigationIndexMetadata>
>;

/** Returns null when no revision exists or the baseline has no index yet. */
async function revisionBaselineIndex(
  domain: DomainRepository,
  canonicalDefinition: CanonicalInvestigationIndexDefinition,
  revision: RevisionId | null
): Promise<ParsedBaselineIndex | null> {
  if (revision === null) return null;
  const revisionFile = await domain.repository.readRevisionFile(
    revision,
    domain.repositoryIndexPath
  );
  if (revisionFile === null) return null;
  return parseStateIndex({
    definition: canonicalDefinition,
    expectation: expectationOf(canonicalDefinition),
    sourcePath: domain.repositoryIndexPath,
    text: decodeUtf8(revisionFile.data)
  });
}

async function domainBaselineIndex(
  domain: DomainRepository,
  canonicalDefinition: CanonicalInvestigationIndexDefinition,
  control: DomainStageControl
): Promise<BaselineOutcome> {
  let revision: RevisionId | null;
  let parsed: ParsedBaselineIndex | null = null;
  try {
    revision = await domain.repository.getCurrentRevision();
    parsed = await revisionBaselineIndex(domain, canonicalDefinition, revision);
  } catch (error) {
    return {
      status: "error",
      result: domainFailure(control, "revision-read-failed", error)
    };
  }
  if (parsed?.status === "error") {
    return {
      status: "error",
      result: domainFailureDiagnostics(
        control,
        "revision-index-invalid",
        parsed.diagnostics
      )
    };
  }
  return {
    status: "ok",
    value: { baseline: parsed?.value ?? null, revision }
  };
}

/** Resolves the published/pending identity union before any selected object is written. */
export function resolveDomainSelection(
  snapshot: Pick<
    DomainSnapshot,
    "baseline" | "workspaceIndex" | "pendingIndex" | "pendingReportPaths"
  >,
  control: DomainStageControl
): DomainStep<DomainSelection> {
  const resolved = resolveInvestigationStageSelectors({
    baseline: snapshot.baseline,
    pending: snapshot.pendingIndex,
    pendingIds: [...snapshot.pendingReportPaths.keys()],
    selectedIds: [...control.input.reportIds],
    workspace: snapshot.workspaceIndex
  });
  if (resolved.status === "error") {
    return {
      status: "error",
      result: domainFailureDiagnostics(
        control,
        "selection-invalid",
        resolved.diagnostics
      )
    };
  }
  const selectedIds = [...new Set(resolved.value)].sort(compareText);
  const missing = missingSelectionResult(snapshot, selectedIds, control);
  if (missing !== null) return missing;
  return {
    status: "ok",
    value: {
      selectedIds,
      sourceSelection: domainSourceSelection(
        snapshot.workspaceIndex,
        selectedIds
      )
    }
  };
}

function missingSelectionResult(
  snapshot: Pick<
    DomainSnapshot,
    "baseline" | "workspaceIndex" | "pendingIndex" | "pendingReportPaths"
  >,
  selectedIds: readonly string[],
  control: DomainStageControl
): Extract<DomainStep<never>, { status: "error" }> | null {
  const missingId = selectedIds.find(
    (id) =>
      !hasEntry(snapshot.baseline, id) &&
      !hasEntry(snapshot.pendingIndex, id) &&
      !snapshot.pendingReportPaths.has(id) &&
      !hasEntry(snapshot.workspaceIndex, id)
  );
  if (missingId !== undefined) {
    return {
      status: "error",
      result: domainFailureDiagnostics(control, "selection-invalid", [
        stageDiagnostic(
          "state-index.selected-id-missing",
          `selected state id ${JSON.stringify(missingId)} is absent from the published and pending identity sets`,
          control.indexPath,
          missingId
        )
      ])
    };
  }
  return null;
}
