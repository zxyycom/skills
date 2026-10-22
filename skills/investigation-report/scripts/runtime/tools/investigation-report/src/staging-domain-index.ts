/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain-index.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain-index.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain-index.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { Buffer } from "node:buffer";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import {
  buildStateIndexFromSnapshot,
  defineStateIndexDefinition,
  sameStateIndexCollectionMetadata,
  selectTargetSnapshot,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import { createInvestigationStateIndexDefinition } from "./investigation-state-index.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { createInvestigationRelationContext } from "./relation-context.ts";
import { validateInvestigationResourceOwnership } from "./resources.ts";
import {
  stageDiagnostic,
  type DomainStageControl,
  type DomainStep
} from "./staging-domain-support.ts";
import type {
  DomainRepository,
  DomainSelection,
  DomainSnapshot
} from "./staging-domain-context.ts";
import { domainFailureDiagnostics } from "./staging-domain-failures.ts";

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

/**
 * Replaces selected pending entries with their workspace published projections;
 * changed collection metadata requires explicit complete-index handling. The
 * `domain` scope keeps `null` so the pending index stays byte-identical.
 */
export function domainIndexFile(
  domain: DomainRepository,
  snapshot: DomainSnapshot,
  selection: DomainSelection,
  control: DomainStageControl
): DomainStep<VersionControlFile | null> {
  if (control.input.scope === "domain") {
    return { status: "ok", value: null };
  }
  const metadataChanged = [snapshot.baseline, snapshot.pendingIndex].some(
    (index) =>
      index !== null &&
      !sameStateIndexCollectionMetadata(index, snapshot.workspaceIndex)
  );
  if (metadataChanged) {
    return {
      status: "error",
      result: domainFailureDiagnostics(control, "collection-changed", [
        stageDiagnostic(
          "state-index.stage-collection-changed",
          "metadata or its source revision changed; stage the complete index instead",
          control.indexPath
        )
      ])
    };
  }
  return indexProjectionFile(domain, snapshot, selection, control);
}

function indexProjectionFile(
  domain: DomainRepository,
  snapshot: DomainSnapshot,
  selection: DomainSelection,
  control: DomainStageControl
): DomainStep<VersionControlFile> {
  const targetSnapshot = selectTargetSnapshot(
    snapshot.pendingIndex,
    snapshot.workspaceIndex,
    new Set(selection.selectedIds)
  );
  const target = buildStateIndexFromSnapshot(
    snapshot.canonicalDefinition,
    targetSnapshot,
    domain.repositoryIndexPath
  );
  if (target.status === "error") {
    return {
      status: "error",
      result: domainFailureDiagnostics(
        control,
        "target-invalid",
        target.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          message: `${diagnostic.message}; explicitly select the required reports or resource owners as well`
        }))
      )
    };
  }
  return {
    status: "ok",
    value: {
      kind: "regular",
      data: Buffer.from(
        serializeStateIndex(target.value, snapshot.canonicalDefinition),
        "utf8"
      ),
      path: domain.repositoryIndexPath
    }
  };
}
