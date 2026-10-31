/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging/domain/staging-domain-index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging/domain/staging-domain-index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging/domain/staging-domain-index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { sameBytes } from "../../../../shared/src/node/bytes.ts";
import { resolveIndexPath } from "../../../../index-runtime/src/storage/index-path.ts";
import { readIndexSourceAtResolvedPath } from "../../../../index-runtime/src/storage/storage-load.ts";
import {
  expectationOf,
  parseStateIndex,
  type StateIndexDiagnostic,
  type StateIndexDefinition,
  type StateIndexResult
} from "../../../../index-runtime/src/index.ts";
import { investigationIndexFileName } from "../../index/investigation-state-index.ts";
import { sanitizeInvestigationDiagnosticText } from "../../diagnostics.ts";
import {
  domainFailure,
  domainFailureDiagnostics
} from "./staging-domain-failures.ts";
import {
  stageDiagnostic,
  type DomainStageControl,
  type DomainStep,
  type InvestigationIndex
} from "./staging-domain-support.ts";
import type {
  InvestigationIndexState,
  InvestigationIndexMetadata
} from "../../types.ts";
import { defineStateIndexDefinition } from "../../../../index-runtime/src/index.ts";
import { createInvestigationStateIndexDefinition } from "../../index/investigation-state-index.ts";
import { validateInvestigationRelationGraph } from "../../relations/relation-validation.ts";
import { createInvestigationRelationContext } from "../../relations/relation-context.ts";
import { validateInvestigationResourceOwnership } from "../../resources/resources.ts";
/** Stage validates the full metadata graph, without reading its source files. */
export function createInvestigationStageIndexDefinition() {
  const definition = createInvestigationStateIndexDefinition();
  return defineStateIndexDefinition({
    ...definition,
    validateIndex(index) {
      definition.validateIndex?.(index);
      const states = new Map(Object.entries(index.entries));
      const references = new Map(
        [...states].map(([id, state]) => [id, new Set(state.resourceIds)])
      );
      const errors = [
        ...validateInvestigationRelationGraph(
          createInvestigationRelationContext(states)
        ),
        ...validateInvestigationResourceOwnership(
          [...states.values()].flatMap((state) => state.resourceIds),
          references
        )
      ];
      if (errors.length > 0) throw new Error(errors.join("; "));
    }
  });
}

export type DomainWorkspaceFacts = Readonly<{
  workspaceIndex: InvestigationIndex;
  workspaceBytes: Uint8Array;
  canonicalDefinition: StateIndexDefinition<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >;
}>;

/** Owns fresh workspace index bytes, parse reuse and complete stage graph validation. */
export async function loadDomainWorkspace(
  control: DomainStageControl,
  previous: DomainWorkspaceFacts | undefined,
  stage: "prepare" | "verify"
): Promise<DomainStep<DomainWorkspaceFacts>> {
  const resolved = await resolveIndexPath(
    investigationIndexFileName,
    control.input.investigationsDirectory
  );
  const source =
    resolved.status === "error"
      ? resolved
      : await readIndexSourceAtResolvedPath({
          indexPath: investigationIndexFileName,
          resolved: resolved.value
        });
  if (source.status === "error")
    return workspaceFailure(control, source.diagnostics, stage);

  const { unchangedWorkspace, workspaceIndex } = workspaceProjection(
    source.value,
    previous
  );
  if (workspaceIndex.status === "error") {
    return workspaceFailure(control, workspaceIndex.diagnostics, stage);
  }
  const definition = createInvestigationStageIndexDefinition();
  if (!unchangedWorkspace) {
    const graph = validateWorkspaceGraph(
      control,
      definition,
      workspaceIndex.value,
      stage
    );
    if (graph.status === "error") return graph;
  }
  return {
    status: "ok",
    value: {
      canonicalDefinition: defineStateIndexDefinition(definition),
      workspaceIndex: workspaceIndex.value,
      workspaceBytes: source.value.bytes
    }
  };
}

function workspaceFailure(
  control: DomainStageControl,
  diagnostics: readonly StateIndexDiagnostic[],
  stage: "prepare" | "verify"
): DomainStep<never> {
  return {
    status: "error",
    result: domainFailureDiagnostics(
      control,
      stage === "prepare" ? "workspace-index-invalid" : "source-drift",
      diagnostics
    )
  };
}

function validateWorkspaceGraph(
  control: DomainStageControl,
  definition: StateIndexDefinition<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >,
  index: InvestigationIndex,
  stage: "prepare" | "verify"
): DomainStep<true> {
  try {
    definition.validateIndex?.(index);
    return { status: "ok", value: true };
  } catch (error) {
    return {
      status: "error",
      result:
        stage === "prepare"
          ? domainFailure(control, "workspace-index-invalid", error)
          : domainFailureDiagnostics(control, "source-drift", [
              stageDiagnostic(
                "investigation-report.stage-source-drift",
                "the published workspace index changed before the write; " +
                  sanitizeInvestigationDiagnosticText(error),
                control.indexPath
              )
            ])
    };
  }
}

/** Parsing and its same-call reuse are owned by the actual workspace source bytes. */
function workspaceProjection(
  source: Readonly<{ bytes: Uint8Array; text: string }>,
  previous: DomainWorkspaceFacts | undefined
): Readonly<{
  unchangedWorkspace: boolean;
  workspaceIndex: StateIndexResult<InvestigationIndex>;
}> {
  const unchangedWorkspace =
    previous !== undefined && sameBytes(source.bytes, previous.workspaceBytes);
  const baseDefinition = createInvestigationStateIndexDefinition();
  const workspaceIndex =
    unchangedWorkspace && previous !== undefined
      ? {
          status: "ok" as const,
          diagnostics: [],
          value: previous.workspaceIndex
        }
      : parseStateIndex({
          definition: baseDefinition,
          expectation: expectationOf(baseDefinition),
          sourcePath: investigationIndexFileName,
          text: source.text
        });
  return { unchangedWorkspace, workspaceIndex };
}
