import * as v from "valibot";
import {
  createStateSourceRevisionSchema,
  defineStateIndexDefinition,
  type ReadonlyStateIndex,
  type StateIndexDefinition,
  type StateSnapshot,
  type StateSourceRevision
} from "../../index-runtime/src/index.ts";
import {
  isDecisionId,
  isDecisionSourcePath,
  isDecisionTag,
  sourcePathForDecision
} from "./decision-path.ts";
import {
  readDecisionSourceRevision,
  readDecisionStateSnapshot
} from "./decision-index-source.ts";
import { decisionSourceFingerprintPatternSource } from "./decision-source-revision.ts";
import { decisionIndexState } from "./decision-state-snapshot.ts";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import { projectionTextIssue } from "./projection.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  establishedDecisionStatuses,
  type DecisionDocument,
  type DecisionIndexMetadata,
  type DecisionIndexState,
  type DecisionMetadata
} from "./types.ts";

export const decisionIndexNamespace = "decisions";
export const decisionIndexDefinitionVersion = 6;

const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check((value) => value.trim().length > 0, "must be non-empty")
);
const decisionIdSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(isDecisionId, "must be a stable Decision ID basename")
);
const sourcePathSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(isDecisionSourcePath, "must be a decision source path")
);
const tagSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(isDecisionTag, "must be a kebab-case tag")
);
const decisionRelationSchema = v.strictObject({
  type: v.picklist(decisionRelationTypes),
  target: decisionIdSchema
});
const decisionIndexStateSchema = v.strictObject({
  sourcePath: sourcePathSchema,
  title: nonEmptyStringSchema,
  status: v.picklist(establishedDecisionStatuses),
  alignment: v.union([v.picklist(decisionAlignments), v.null()]),
  createdAt: nonEmptyStringSchema,
  purpose: nonEmptyStringSchema,
  background: nonEmptyStringSchema,
  decision: nonEmptyStringSchema,
  tags: v.pipe(v.array(tagSchema), v.minLength(1)),
  relations: v.array(decisionRelationSchema)
});
const decisionIndexMetadataSchema = v.strictObject({});
const sourceFingerprintSchema = v.pipe(
  v.string("must be a string"),
  v.regex(
    new RegExp(decisionSourceFingerprintPatternSource, "u"),
    "must be a sha256 decision source fingerprint"
  )
);
const decisionSourceRevisionSchema = createStateSourceRevisionSchema({
  fingerprint: sourceFingerprintSchema,
  id: decisionIdSchema
});

type DecisionIndexDefinitionOptions = {
  decisionIds?: readonly string[];
};

export function createDecisionStateIndexDefinition(
  options: DecisionIndexDefinitionOptions = {}
): StateIndexDefinition<DecisionIndexState, DecisionIndexMetadata> {
  const decisionIds = options.decisionIds;
  return defineStateIndexDefinition({
    definitionVersion: decisionIndexDefinitionVersion,
    fieldOrder: "definition",
    keyStrategies: [
      {
        derive: (state) => state.tags,
        mode: "exact",
        name: "tag"
      },
      {
        derive: (state) => state.status,
        mode: "exact",
        name: "status"
      },
      {
        derive: (state) => state.alignment ?? undefined,
        mode: "exact",
        name: "alignment"
      }
    ],
    namespace: decisionIndexNamespace,
    parseMetadata: parseDecisionIndexMetadata,
    parseState: parseDecisionIndexState,
    read: decisionIds === undefined
      ? unavailableRead
      : async (context) => await readDecisionStateSnapshot(
        context.root,
        decisionIds,
        context.signal
      ),
    readRevision: decisionIds === undefined
      ? unavailableRevisionRead
      : async (context) => await readDecisionSourceRevision(
        context.root,
        decisionIds,
        context.signal
      ),
    validateIndex: validateDecisionSourceRevision
  });
}

function validateDecisionSourceRevision(
  index: ReadonlyStateIndex<DecisionIndexState, DecisionIndexMetadata>
): void {
  const parsed = v.safeParse(decisionSourceRevisionSchema, index.sourceRevision);
  if (!parsed.success) {
    throw new TypeError(
      parsed.issues.map(formatDecisionIndexIssue).join("; ")
    );
  }
}

function parseDecisionIndexState(input: Parameters<
  StateIndexDefinition<
    DecisionIndexState,
    DecisionIndexMetadata
  >["parseState"]
>[0], context: Parameters<
  StateIndexDefinition<
    DecisionIndexState,
    DecisionIndexMetadata
  >["parseState"]
>[1]): DecisionIndexState {
  const parsed = v.safeParse(decisionIndexStateSchema, input);
  if (!parsed.success) {
    throw new TypeError(parsed.issues.map(formatDecisionIndexIssue).join("; "));
  }

  const state = parsed.output;
  if (!isDecisionId(context.id)) {
    throw new TypeError("entry id must be a stable Decision ID basename");
  }
  if (state.sourcePath !== sourcePathForDecision(context.id, state.status)) {
    throw new TypeError("state.sourcePath must match the Decision ID and lifecycle status");
  }
  if (!isDecisionTimestamp(state.createdAt)) {
    throw new TypeError(
      "createdAt must be an RFC 3339 timestamp precise to seconds "
      + "with an explicit timezone"
    );
  }
  const metadata: DecisionMetadata = state.status === "active"
    ? {
        status: "active",
        alignment: activeAlignment(state.alignment),
        createdAt: state.createdAt
      }
    : {
        status: "archived",
        alignment: state.alignment,
        createdAt: state.createdAt
      };

  for (const field of ["title", "purpose", "background", "decision"] as const) {
    const issue = projectionTextIssue(state[field]);
    if (issue !== null) {
      throw new TypeError(`${field} ${issue}`);
    }
  }
  if (!strictlyAscendingUnique(state.tags)) {
    throw new TypeError("tags must be unique and lexical ascending");
  }

  const relationTargets = new Set<string>();
  for (const relation of state.relations) {
    if (relationTargets.has(relation.target)) {
      throw new TypeError(`repeats relationship target ${relation.target}`);
    }
    relationTargets.add(relation.target);
  }

  const document: DecisionDocument = {
    title: state.title,
    ...metadata,
    purpose: state.purpose,
    background: state.background,
    decision: state.decision,
    tags: state.tags,
    relations: state.relations
  };
  return decisionIndexState(state.sourcePath, document);
}

function formatDecisionIndexIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath} ${issue.message}`;
}

function activeAlignment(
  alignment: DecisionIndexState["alignment"]
): "aligned" | "unaligned" {
  if (alignment === null) {
    throw new TypeError(
      "alignment must be aligned or unaligned when status is active"
    );
  }
  return alignment;
}

function parseDecisionIndexMetadata(
  input: Parameters<StateIndexDefinition<
    DecisionIndexState,
    DecisionIndexMetadata
  >["parseMetadata"]>[0]
): DecisionIndexMetadata {
  return v.parse(decisionIndexMetadataSchema, input);
}

function strictlyAscendingUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

async function unavailableRead(): Promise<StateSnapshot<
  DecisionIndexState,
  DecisionIndexMetadata
>> {
  throw new Error("decision state reader is unavailable in this operation");
}

async function unavailableRevisionRead(): Promise<StateSourceRevision> {
  throw new Error("decision revision reader is unavailable in this operation");
}
