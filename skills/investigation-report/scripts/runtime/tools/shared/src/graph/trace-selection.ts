/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/graph/trace-selection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/graph/trace-selection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/graph/trace-selection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { RelationGraph } from "./relations.ts";
import type {
  RelationGraphTraceAdmissionAdapter,
  RelationGraphTraceAdmissionUnit,
  RelationGraphTraceBlockedEvent,
  RelationGraphTraceExpansionDirection,
  RelationGraphTraceSelection,
  RelationGraphTraceSelectionOptions
} from "./trace-contract.ts";
import {
  compareStrings,
  compareTraceFrontier,
  normalizeAdmissionUnits,
  createTraceAdmissionNormalization
} from "./trace-ordering.ts";

/**
 * Selects a bounded relation slice without assigning meaning to relation
 * types. Domains provide complete admission units for their split, merge, or
 * reallocation semantics; this function owns deterministic BFS selection,
 * membership, budgets, and continuation boundaries.
 */
export function selectRelationGraphTrace<
  Id extends string,
  Type extends string
>(
  graph: RelationGraph<Id, Type>,
  startId: Id,
  options: RelationGraphTraceSelectionOptions,
  admissionUnits: RelationGraphTraceAdmissionAdapter<Id, Type>
): RelationGraphTraceSelection<Id> {
  const normalization = createTraceAdmissionNormalization<Id>();
  const admittedUnits = new WeakSet<RelationGraphTraceAdmissionUnit<Id>>();
  const admittedMemberGroups = new WeakSet<readonly Id[]>();
  const traceIds = new Set<Id>([startId]);
  const contextIds = new Set<Id>();
  const depthByTraceId = new Map<Id, number>([[startId, 0]]);
  let currentLayer: Id[] = [startId];
  let currentDepth = 0;
  const frontiers = new Map<
    string,
    {
      direction: RelationGraphTraceExpansionDirection;
      fromId: Id;
      nextIds: Set<Id>;
      reason: "depth" | "max-records";
    }
  >();
  let blockedEvent: RelationGraphTraceBlockedEvent<Id> | undefined;
  let stoppedByBudget = false;

  function addFrontier(
    fromId: Id,
    direction: RelationGraphTraceExpansionDirection,
    reason: "depth" | "max-records",
    nextIds: Iterable<Id>
  ): void {
    const ids = [...new Set(nextIds)].sort(compareStrings) as Id[];
    if (ids.length === 0) {
      return;
    }
    const key = `${fromId}\u0000${direction}\u0000${reason}`;
    const existing = frontiers.get(key);
    if (existing === undefined) {
      frontiers.set(key, {
        direction,
        fromId,
        nextIds: new Set(ids),
        reason
      });
      return;
    }
    for (const id of ids) {
      existing.nextIds.add(id);
    }
  }

  function directIds(
    fromId: Id,
    direction: RelationGraphTraceExpansionDirection
  ): Id[] {
    const edges = directEdges(fromId, direction);
    const ids = new Set<Id>();
    for (const edge of edges) {
      const id = directId(edge, direction);
      if (graph.ids.has(id)) ids.add(id);
    }
    return [...ids].sort(compareStrings) as Id[];
  }

  function directEdges(
    fromId: Id,
    direction: RelationGraphTraceExpansionDirection
  ) {
    return direction === "predecessors"
      ? (graph.edgesBySource.get(fromId) ?? [])
      : (graph.edgesByTarget.get(fromId) ?? []);
  }

  function directId(
    edge: (typeof graph.edges)[number],
    direction: RelationGraphTraceExpansionDirection
  ): Id {
    return direction === "predecessors" ? edge.target : edge.source;
  }

  function requestedDirections(): readonly RelationGraphTraceExpansionDirection[] {
    if (options.direction === "predecessors") {
      return ["predecessors"];
    }
    if (options.direction === "successors") {
      return ["successors"];
    }
    return ["predecessors", "successors"];
  }

  function addDirectFrontiers(
    ids: Iterable<Id>,
    reason: "depth" | "max-records"
  ): void {
    for (const id of ids) {
      for (const direction of requestedDirections()) {
        addFrontier(id, direction, reason, directIds(id, direction));
      }
    }
  }

  type BudgetFrontierContext = {
    currentDirection: RelationGraphTraceExpansionDirection;
    currentId: Id;
    currentLayerIndex: number;
    currentUnitIndex: number;
    currentUnits: readonly RelationGraphTraceAdmissionUnit<Id>[];
    nextLayer: ReadonlySet<Id>;
  };

  const addBudgetFrontiers = (budget: BudgetFrontierContext): void => {
    const {
      currentDirection,
      currentId,
      currentLayerIndex,
      currentUnitIndex,
      currentUnits,
      nextLayer
    } = budget;
    addFrontier(
      currentId,
      currentDirection,
      "max-records",
      currentUnits.slice(currentUnitIndex).flatMap((unit) => unit.traceIds)
    );

    const currentDirections = requestedDirections();
    const followingDirections = currentDirections.slice(
      currentDirections.indexOf(currentDirection) + 1
    );
    for (const direction of followingDirections) {
      addFrontier(
        currentId,
        direction,
        "max-records",
        directIds(currentId, direction)
      );
    }

    addDirectFrontiers(
      currentLayer.slice(currentLayerIndex + 1),
      "max-records"
    );
    addDirectFrontiers(
      nextLayer,
      options.maxDepth !== null && currentDepth + 1 >= options.maxDepth
        ? "depth"
        : "max-records"
    );
  };

  while (currentLayer.length > 0 && !stoppedByBudget) {
    const nextLayer = new Set<Id>();
    currentLayer.sort(compareStrings);
    for (
      let currentLayerIndex = 0;
      currentLayerIndex < currentLayer.length;
      currentLayerIndex += 1
    ) {
      const currentId = currentLayer[currentLayerIndex];
      if (
        currentId === undefined ||
        depthByTraceId.get(currentId) !== currentDepth
      ) {
        continue;
      }

      for (const direction of requestedDirections()) {
        if (options.maxDepth !== null && currentDepth >= options.maxDepth) {
          addFrontier(
            currentId,
            direction,
            "depth",
            directIds(currentId, direction)
          );
          continue;
        }

        const units = normalizeAdmissionUnits(
          admissionUnits({ direction, fromId: currentId, graph }),
          normalization
        );
        for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
          const unit = units[unitIndex];
          // BFS 深度单调，同一完整 normalized unit 成功接纳后不会再改变成员或深度。
          // 仍保留 units 和 unitIndex，预算 frontier 需要完整的剩余单位。
          if (unit === undefined || admittedUnits.has(unit)) {
            continue;
          }
          const membersAdmitted = admittedMemberGroups.has(unit.recordIds);
          const newIds = membersAdmitted
            ? []
            : unit.recordIds.filter(
                (id) => !traceIds.has(id) && !contextIds.has(id)
              );
          if (
            traceIds.size + contextIds.size + newIds.length >
            options.maxRecords
          ) {
            if (unit.kind !== "ordinary") {
              blockedEvent = {
                kind: unit.kind,
                recordIds: unit.recordIds,
                requiredMaxRecords:
                  traceIds.size + contextIds.size + newIds.length
              };
            }
            stoppedByBudget = true;
            addBudgetFrontiers({
              currentDirection: direction,
              currentId,
              currentLayerIndex,
              currentUnitIndex: unitIndex,
              currentUnits: units,
              nextLayer
            });
            break;
          }

          const directTraceIds = new Set(unit.traceIds);
          if (!membersAdmitted) {
            for (const id of unit.recordIds) {
              if (!traceIds.has(id) && !directTraceIds.has(id))
                contextIds.add(id);
            }
          }
          for (const id of directTraceIds) {
            contextIds.delete(id);
            if (!traceIds.has(id)) {
              traceIds.add(id);
            }
            const nextDepth = currentDepth + 1;
            const knownDepth = depthByTraceId.get(id);
            if (knownDepth === undefined || nextDepth < knownDepth) {
              depthByTraceId.set(id, nextDepth);
              nextLayer.add(id);
            }
          }
          // Context admission and direct promotion now complete this group's union membership.
          if (!membersAdmitted) admittedMemberGroups.add(unit.recordIds);
          admittedUnits.add(unit);
        }
        if (stoppedByBudget) break;
      }
      if (stoppedByBudget) break;
    }
    currentLayer = [...nextLayer];
    currentDepth += 1;
  }

  const frontier = [...frontiers.values()]
    .map(({ direction, fromId, nextIds, reason }) => ({
      fromId,
      direction,
      reason,
      nextIds: [...nextIds].sort(compareStrings) as Id[]
    }))
    .sort(compareTraceFrontier);
  const stoppedBy: Array<"depth" | "max-records"> = [];
  if (frontier.some((item) => item.reason === "depth")) {
    stoppedBy.push("depth");
  }
  if (frontier.some((item) => item.reason === "max-records")) {
    stoppedBy.push("max-records");
  }

  return {
    ...(blockedEvent === undefined ? {} : { blockedEvent }),
    contextIds: [...contextIds].sort(compareStrings) as Id[],
    coverage: {
      complete: stoppedBy.length === 0 && blockedEvent === undefined,
      stoppedBy
    },
    frontier,
    traceIds: [...traceIds].sort(compareStrings) as Id[]
  };
}
