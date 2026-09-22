import path from "node:path";
import type {
  RevisionId,
  VersionControlFile,
  VersionControlRepository
} from "../../shared/src/version-control/index.ts";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  defineStateIndexDefinition,
  expectationOf,
  hasEntry,
  parseStateIndex,
  type StateIndexDefinition
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName,
  loadInvestigationIndex
} from "./investigation-state-index.ts";
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

type CanonicalInvestigationIndexDefinition = StateIndexDefinition<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

export type DomainRepository = Readonly<{
  investigationsScope: string;
  repository: VersionControlRepository;
  repositoryIndexPath: string;
}>;

export type DomainSnapshot = Readonly<{
  baseline: InvestigationIndex | null;
  canonicalDefinition: CanonicalInvestigationIndexDefinition;
  revision: RevisionId | null;
  workspaceIndex: InvestigationIndex;
}>;

export type DomainSelection = Readonly<{
  selectedIds: string[];
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

/**
 * Loads the fresh workspace index plus the `HEAD` baseline index so selector
 * resolution can cover additions, updates, and baseline-only deletions.
 */
export async function loadDomainSnapshot(
  domain: DomainRepository,
  control: DomainStageControl
): Promise<DomainStep<DomainSnapshot>> {
  const workspaceIndex = await loadInvestigationIndex({
    investigationsDirectory: control.input.investigationsDirectory
  });
  if (workspaceIndex.status === "error") {
    return {
      status: "error",
      result: domainFailureDiagnostics(
        control,
        "workspace-index-invalid",
        workspaceIndex.diagnostics
      )
    };
  }
  const definition = createInvestigationStateIndexDefinition();
  const canonicalDefinition = defineStateIndexDefinition(definition);
  const baseline = await domainBaselineIndex(
    domain,
    canonicalDefinition,
    control
  );
  if (baseline.status === "error") return baseline;
  return {
    status: "ok",
    value: {
      baseline: baseline.value.baseline,
      canonicalDefinition,
      revision: baseline.value.revision,
      workspaceIndex: workspaceIndex.value
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

/**
 * Resolves selectors against the workspace and `HEAD` baseline ID union;
 * every resolved ID must exist on at least one side so a typo stops the
 * transaction instead of staging a partial selection.
 */
export function resolveDomainSelection(
  snapshot: DomainSnapshot,
  control: DomainStageControl
): DomainStep<DomainSelection> {
  const resolved = resolveInvestigationStageSelectors({
    baseline: snapshot.baseline,
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
  const missingId = selectedIds.find(
    (id) =>
      !hasEntry(snapshot.baseline, id) && !hasEntry(snapshot.workspaceIndex, id)
  );
  if (missingId !== undefined) {
    return {
      status: "error",
      result: domainFailureDiagnostics(control, "selection-invalid", [
        stageDiagnostic(
          "state-index.selected-id-missing",
          `selected state id ${JSON.stringify(missingId)} is absent from both indexes`,
          control.indexPath,
          missingId
        )
      ])
    };
  }
  return { status: "ok", value: { selectedIds } };
}

export async function readPendingScope(
  repository: VersionControlRepository,
  investigationsScope: string
): Promise<
  | { status: "ok"; value: VersionControlFile[] }
  | { status: "error"; error: unknown }
> {
  try {
    return {
      status: "ok",
      value: await repository.readPendingFiles({
        pathScopes: [investigationsScope]
      })
    };
  } catch (error) {
    return { status: "error", error };
  }
}

export async function readHeadScope(
  repository: VersionControlRepository,
  revision: RevisionId | null,
  investigationsScope: string
): Promise<
  | { status: "ok"; value: VersionControlFile[] }
  | { status: "error"; error: unknown }
> {
  try {
    return {
      status: "ok",
      value:
        revision === null
          ? []
          : await repository.readRevisionFiles(revision, {
              pathScopes: [investigationsScope]
            })
    };
  } catch (error) {
    return { status: "error", error };
  }
}
