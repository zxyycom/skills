/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-lifecycle-relations.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-lifecycle-relations.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-lifecycle-relations.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionDiagnosticFromReason,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { bindRelationSummaries } from "./relation-summary.ts";
import type {
  DecisionId,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionRelationOverrideGroup,
  DecisionRelationSummary,
  DecisionSuccessor
} from "./types.ts";

export function resolveRelationOverride(
  override: DecisionRelationOverride,
  resolve: (selector: string) => DecisionId | null
): DecisionRelationOverride | DecisionApplicationFailure | null {
  if (override.kind === "source") return override;
  const relations: DecisionRelation[] = [];
  for (const relation of override.relations) {
    const target = resolve(relation.target);
    if (target === null) return null;
    relations.push({ ...relation, target });
  }
  const summaries: DecisionRelationSummary[] = [];
  for (const summary of override.relationSummaries ?? []) {
    const target = resolve(summary.target);
    if (target === null) return null;
    summaries.push({ ...summary, target });
  }
  const duplicateTarget = duplicateRelationSelectorTarget(relations, summaries);
  if (duplicateTarget !== null) {
    return decisionFailure([
      "Relation selectors resolve to the same direct predecessor target: " +
        duplicateTarget
    ]);
  }
  const bound = bindRelationSummaries(relations, summaries);
  if ("error" in bound) {
    return decisionFailure(
      [
        decisionDiagnosticFromReason(
          {
            code: "decision-records.relation-summary-invalid",
            recovery:
              "Provide each --relation-summary target once in the complete relation set, then retry.",
            target: "--relation-summary"
          },
          bound.error
        )
      ],
      { presentation: "plain" }
    );
  }
  return { kind: "replace", relations: bound.relations };
}

function duplicateRelationSelectorTarget(
  relations: readonly DecisionRelation[],
  summaries: readonly DecisionRelationSummary[]
): DecisionId | null {
  const relationTargets = new Set<DecisionId>();
  for (const relation of relations) {
    if (relationTargets.has(relation.target)) return relation.target;
    relationTargets.add(relation.target);
  }
  const summaryTargets = new Set<DecisionId>();
  for (const summary of summaries) {
    if (summaryTargets.has(summary.target)) return summary.target;
    summaryTargets.add(summary.target);
  }
  return null;
}

export function resolveRelationOverrideGroups(
  groups: readonly DecisionRelationOverrideGroup[],
  resolve: (selector: string) => DecisionId | null
): DecisionRelationOverrideGroup[] | DecisionApplicationFailure | null {
  const resolved: DecisionRelationOverrideGroup[] = [];
  for (const group of groups) {
    const source = resolve(group.source);
    if (source === null) return null;
    const relationOverride = resolveRelationOverride(
      group.relationOverride,
      resolve
    );
    if (relationOverride === null) return null;
    if ("status" in relationOverride) return relationOverride;
    resolved.push({ relationOverride, source });
  }
  return resolved;
}

export function attachSuccessorRelationOverrides(
  successors: readonly DecisionSuccessor[],
  groups: readonly DecisionRelationOverrideGroup[]
): DecisionSuccessor[] | DecisionApplicationFailure {
  const overrides = new Map<DecisionId, DecisionRelationOverride>();
  const selected = new Set(successors.map((successor) => successor.decisionId));
  for (const group of groups) {
    if (!selected.has(group.source)) {
      return decisionFailure([
        "--source group is not a selected successor: " + group.source
      ]);
    }
    if (overrides.has(group.source)) {
      return decisionFailure([
        "--source resolves to the same selected successor more than once: " +
          group.source
      ]);
    }
    overrides.set(group.source, group.relationOverride);
  }
  return successors.map((successor) => {
    const relationOverride = overrides.get(successor.decisionId);
    return relationOverride === undefined
      ? successor
      : { ...successor, relationOverride };
  });
}
