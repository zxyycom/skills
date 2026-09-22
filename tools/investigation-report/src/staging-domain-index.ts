import { Buffer } from "node:buffer";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import {
  buildStateIndexFromSnapshot,
  sameStateIndexCollectionMetadata,
  selectTargetSnapshot,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
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

/**
 * Builds the derived index projection for the `all` scope from the fresh
 * workspace projection over the selected entries; changed collection metadata
 * stops the selective projection in favor of a complete index stage. The
 * `domain` scope keeps `null` so the pending index stays byte-identical.
 */
export function domainIndexFile(
  domain: DomainRepository,
  snapshot: DomainSnapshot,
  selection: DomainSelection,
  control: DomainStageControl
): DomainStep<VersionControlFile | null> {
  if (control.input.scope !== "all") {
    return { status: "ok", value: null };
  }
  const metadataChanged =
    snapshot.baseline !== null &&
    !sameStateIndexCollectionMetadata(
      snapshot.baseline,
      snapshot.workspaceIndex
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
    snapshot.baseline,
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
        target.diagnostics
      )
    };
  }
  return {
    status: "ok",
    value: {
      data: Buffer.from(
        serializeStateIndex(target.value, snapshot.canonicalDefinition),
        "utf8"
      ),
      path: domain.repositoryIndexPath
    }
  };
}
