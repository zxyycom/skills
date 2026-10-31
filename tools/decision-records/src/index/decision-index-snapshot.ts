import {
  loadRecordQuery,
  recordGraphProof
} from "../../../record-operations/src/query.ts";
import {
  createDecisionRelationGraphProvider,
  decisionRelationConsistencyIssues,
  type DecisionRelationGraphProvider
} from "../relations/relation-graph.ts";
import { isDecisionId } from "../collection/decision-path.ts";
import {
  loadCurrentStateIndexReader,
  parseStateIndex,
  queryStateIndex,
  type ReadonlyStateIndex,
  type StateIndex,
  type StateIndexContext,
  type StateIndexResult
} from "../../../index-runtime/src/index.ts";
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
} from "../types.ts";

export type DecisionIndexSnapshot = Readonly<{
  index: DecisionIndex;
  entries: readonly Readonly<{ id: string; state: DecisionIndexState }>[];
  getRelationGraph: DecisionRelationGraphProvider;
  relationErrors: () => readonly string[];
}>;

type DecisionIndexLoadOptions = {
  decisionsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
  queryOnly?: boolean;
};

export async function loadDecisionIndexSnapshot(
  options: DecisionIndexLoadOptions
): Promise<StateIndexResult<DecisionIndexSnapshot>> {
  const indexPath = options.indexPath ?? decisionIndexFileName;
  return await loadRecordQuery({
    context: {
      root: options.decisionsDirectory,
      ...(options.signal === undefined ? {} : { signal: options.signal })
    },
    definition: createDecisionStateIndexDefinition(),
    expectation: {
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    },
    indexPath,
    project: (reader) =>
      decisionIndexSnapshotFromValidatedIndex(reader.index, indexPath, true),
    requiresRelations: options.queryOnly !== true,
    relationErrors: (snapshot) => snapshot.relationErrors(),
    relationFailureCode: "decision-index.relation-invalid"
  });
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
  const current = await loadCurrentStateIndexReader({
    context,
    definition,
    indexPath
  });
  if (current.status === "error") {
    return current;
  }
  const validated = decisionIndexSnapshotFromValidatedIndex(
    current.value.index,
    indexPath
  );
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
  return decisionIndexSnapshotFromValidatedIndex(index, sourcePath);
}

export function parseDecisionIndexSnapshot(
  text: string,
  sourcePath: string
): StateIndexResult<DecisionIndexSnapshot> {
  const parsed = parseStateIndex({
    definition: createDecisionStateIndexDefinition(),
    expectation: {
      definitionVersion: decisionIndexDefinitionVersion,
      namespace: decisionIndexNamespace
    },
    sourcePath,
    text
  });
  return parsed.status === "error"
    ? parsed
    : decisionIndexSnapshotFromValidatedIndex(parsed.value, sourcePath);
}

// 内部接点：输入须已在同阶段通过结构、metadata/state、查询字段及 definition 验收。
// 默认验收完整领域关系图；queryOnly 将验收留给 relationErrors 的消费者。
export function decisionIndexSnapshotFromValidatedIndex(
  validatedIndex: ReadonlyStateIndex<DecisionIndexState, DecisionIndexMetadata>,
  sourcePath: string,
  queryOnly = false
): StateIndexResult<DecisionIndexSnapshot> {
  // 适配只读输入以兼容现有 Decision DTO 的可变数组类型；不改变输入的对象或冻结状态。
  const index = validatedIndex as StateIndex<
    DecisionIndexState,
    DecisionIndexMetadata
  >;
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
  const relationErrors = recordGraphProof(getRelationGraph, (graph) =>
    decisionRelationConsistencyIssues(() => graph).map((issue) => issue.message)
  );
  const errors = queryOnly ? [] : relationErrors();
  if (errors.length > 0)
    return failure(
      "decision-index.relation-invalid",
      errors.join("; "),
      sourcePath
    );
  return {
    diagnostics: [],
    status: "ok",
    // definition 已验收 state 与 ID；此处将索引身份收窄为本领域固定的 namespace/definitionVersion。
    value: {
      entries,
      getRelationGraph,
      relationErrors,
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
