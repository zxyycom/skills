/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-index-snapshot.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-index-snapshot.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-index-snapshot.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  createDecisionRelationGraphProvider,
  decisionRelationConsistencyIssues,
  type DecisionRelationGraphProvider
} from "./relation-graph.ts";
import { isDecisionId } from "./decision-path.ts";
import {
  loadCurrentStateIndex,
  loadStateIndex,
  queryStateIndex,
  type StateIndex,
  type StateIndexContext,
  type StateIndexResult
} from "../../index-runtime/src/index.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexDefinitionVersion,
  decisionIndexFileName,
  decisionIndexNamespace
} from "./decision-index-definition.ts";
import type {
  DecisionIndex,
  DecisionIndexMetadata,
  DecisionIndexState
} from "./types.ts";

export type DecisionIndexSnapshot = Readonly<{
  index: DecisionIndex;
  entries: readonly Readonly<{ id: string; state: DecisionIndexState }>[];
  getRelationGraph: DecisionRelationGraphProvider;
}>;

type DecisionIndexLoadOptions = {
  decisionsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
};

export async function loadDecisionIndexSnapshot(
  options: DecisionIndexLoadOptions
): Promise<StateIndexResult<DecisionIndexSnapshot>> {
  const indexPath = options.indexPath ?? decisionIndexFileName;
  const loaded = await loadStateIndex({
    context: {
      root: options.decisionsDirectory,
      ...(options.signal === undefined ? {} : { signal: options.signal })
    },
    definition: createDecisionStateIndexDefinition(),
    expectation: {
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    },
    indexPath
  });
  return loaded.status === "error"
    ? loaded
    : validateDecisionIndexSnapshot(loaded.value, indexPath);
}

type CurrentDecisionIndexLoadOptions = DecisionIndexLoadOptions & {
  decisionIds: readonly string[];
};

export async function loadCurrentDecisionIndexSnapshot(
  options: CurrentDecisionIndexLoadOptions
): Promise<StateIndexResult<DecisionIndexSnapshot>> {
  const indexPath = options.indexPath ?? decisionIndexFileName;
  const context: StateIndexContext = {
    root: options.decisionsDirectory,
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };
  const definition = createDecisionStateIndexDefinition({
    decisionIds: options.decisionIds
  });
  const current = await loadCurrentStateIndex({
    context,
    definition,
    indexPath
  });
  if (current.status === "error") {
    return current;
  }
  const validated = validateDecisionIndexSnapshot(current.value, indexPath);
  if (validated.status === "error") {
    return validated;
  }
  const membership = validateDecisionIndexMembership(
    validated.value.index,
    options.decisionIds,
    indexPath
  );
  return membership.status === "error" ? membership : validated;
}

function validateDecisionIndexMembership(
  index: DecisionIndex,
  decisionIds: readonly string[],
  sourcePath: string
): StateIndexResult<DecisionIndex> {
  const expectedIds = [...new Set(decisionIds)].sort(compareText);
  const indexedIds = Object.keys(index.entries).sort(compareText);
  if (
    expectedIds.length === indexedIds.length &&
    expectedIds.every((entry, entryIndex) => entry === indexedIds[entryIndex])
  ) {
    return { diagnostics: [], status: "ok", value: index };
  }

  const expectedIdSet = new Set(expectedIds);
  const indexedIdSet = new Set(indexedIds);
  const missingIds = expectedIds.filter((entry) => !indexedIdSet.has(entry));
  const unexpectedIds = indexedIds.filter((entry) => !expectedIdSet.has(entry));
  const details = [
    ...(missingIds.length === 0 ? [] : ["missing: " + missingIds.join(", ")]),
    ...(unexpectedIds.length === 0
      ? []
      : ["unexpected: " + unexpectedIds.join(", ")])
  ];
  return failure(
    "decision-index.membership-mismatch",
    "index entries do not match the complete established Markdown set" +
      (details.length === 0 ? "" : "; " + details.join("; ")),
    sourcePath
  );
}

export function snapshotIndex(
  result: StateIndexResult<DecisionIndexSnapshot>
): StateIndexResult<DecisionIndex> {
  return result.status === "error"
    ? result
    : {
        diagnostics: result.diagnostics,
        status: "ok",
        value: result.value.index
      };
}

export function validateDecisionIndexSnapshot(
  index: StateIndex<DecisionIndexState, DecisionIndexMetadata>,
  sourcePath: string
): StateIndexResult<DecisionIndexSnapshot> {
  const validated = queryStateIndex({
    definition: createDecisionStateIndexDefinition(),
    index,
    query: { limit: 1 }
  });
  if (validated.status === "error") {
    return {
      diagnostics: validated.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        path: diagnostic.path ?? sourcePath
      })),
      status: "error",
      value: null
    };
  }
  const entries = Object.entries(index.entries).map(([id, state]) => ({
    id,
    state
  }));
  const getRelationGraph = createDecisionRelationGraphProvider(
    entries.map(({ id: decisionId, state }) => {
      if (!isDecisionId(decisionId))
        throw new TypeError("validated index must use a Decision ID");
      return {
        decisionId,
        projection: state,
        sourcePath: state.sourcePath,
        status: state.status
      };
    })
  );
  const relationIssues = decisionRelationConsistencyIssues(getRelationGraph);
  if (relationIssues.length > 0)
    return failure(
      "decision-index.relation-invalid",
      relationIssues.map((issue) => issue.message).join("; "),
      sourcePath
    );
  return {
    diagnostics: [],
    status: "ok",
    // The state-index parser and decision definition have validated this exact
    // schema and key projection before it crosses the public decision boundary.
    value: {
      entries,
      getRelationGraph,
      index: {
        ...index,
        definitionVersion: decisionIndexDefinitionVersion,
        namespace: decisionIndexNamespace
      } as DecisionIndex
    }
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function failure<Value>(
  code: string,
  message: string,
  sourcePath: string
): StateIndexResult<Value> {
  return {
    diagnostics: [
      {
        code,
        message,
        path: sourcePath,
        stateId: null
      }
    ],
    status: "error",
    value: null
  };
}
