import type { InvestigationPreparation } from "./strict-preparation.ts";
import type {
  InvestigationRenamePlan,
  PreparedRename,
  RenameSource,
  ResourceMove
} from "./rename-contract.ts";
import type { RenameTarget } from "./rename-preparation-source.ts";
import { investigationNameFromId } from "./report-path.ts";
import { countText, type RenameStep } from "./rename-support.ts";
export function noChangePreparation(
  indexPath: string,
  sources: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget
): RenameStep<PreparedRename> {
  return {
    value: {
      indexPath,
      noChange: true,
      nextIndexText: null,
      oldIndexText: null,
      originalSources: sources,
      plan: renamePlan(sources, source, target, sources, false),
      resourceMove: null,
      sourceBefore: source,
      sources,
      targetSource: source
    }
  };
}

type ChangedRenameFacts = Readonly<{
  indexPath: string;
  preparation: InvestigationPreparation;
  sources: readonly RenameSource[];
  source: RenameSource;
  target: RenameTarget;
  rewritten: readonly RenameSource[];
  resourceMove: ResourceMove | null;
  index: Readonly<{
    nextIndexText: string | null;
    oldIndexText: string | null;
  }>;
}>;

/** Project the validated rewrite into its complete publication plan, without I/O. */
export function changedRenamePreparation(
  facts: ChangedRenameFacts
): PreparedRename {
  const {
    indexPath,
    preparation,
    source,
    target,
    sources,
    rewritten,
    resourceMove,
    index
  } = facts;
  return {
    indexPath,
    preparation,
    noChange: false,
    nextIndexText: source.candidate ? null : index.nextIndexText,
    oldIndexText: index.oldIndexText,
    originalSources: sources,
    plan: renamePlan(sources, source, target, rewritten, resourceMove !== null),
    resourceMove,
    sourceBefore: source,
    sources: rewritten,
    targetSource: rewritten.find((candidate) => candidate.id === target.id)!
  };
}

export function renamePlan(
  before: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget,
  after: readonly RenameSource[],
  resourceOwnerMoved: boolean
): InvestigationRenamePlan {
  const identityChanged = source.id !== target.id;
  const relationCounts = identityChanged
    ? before.reduce(
        (counts, current) => {
          const affected = current.document.relations.filter(
            (relation) => relation.target === source.id
          ).length;
          if (current.candidate) counts.candidate += affected;
          else counts.established += affected;
          return counts;
        },
        { candidate: 0, established: 0 }
      )
    : { candidate: 0, established: 0 };
  const resourcePrefix = `./_resources/${source.id}/`;
  const affectedResourceReferenceCount = identityChanged
    ? before.reduce(
        (count, current) =>
          count + countText(current.text, `](${resourcePrefix}`),
        0
      )
    : 0;
  const next = after.find((current) => current.id === target.id)!;
  return {
    affectedCandidateRelationCount: relationCounts.candidate,
    affectedEstablishedRelationCount: relationCounts.established,
    affectedResourceReferenceCount,
    newId: target.id,
    newName: target.name,
    newSourcePath: next.sourcePath,
    oldId: source.id,
    oldName: investigationNameFromId(source.id),
    oldSourcePath: source.sourcePath,
    outcome: "ready",
    resourceOwnerMoved
  };
}
