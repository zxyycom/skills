import * as v from "valibot";
import {
  createStateSourceRevisionSchema,
  defineStateIndexDefinition,
  type ReadonlyStateIndex,
  type StateIndexDefinition,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import {
  readInvestigationSourceRevision,
  readInvestigationStateSnapshot
} from "./investigation-index-source.ts";
import { investigationSourceFingerprintPatternSource } from "./investigation-source-revision.ts";
import { isInvestigationId, isInvestigationTag } from "./report-path.ts";
import { isInvestigationResourceId } from "./resource-reference.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  investigationRelationTypes,
  type InvestigationIndexMetadata,
  type InvestigationRelation,
  type InvestigationIndexState
} from "./types.ts";

export const investigationIndexNamespace = "investigations";
export const investigationIndexDefinitionVersion = 6;

const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check(
    (value) =>
      value.length > 0 && value.trim() === value && !value.includes("\n"),
    "must be non-empty single-line text without surrounding whitespace"
  )
);
const investigationIdSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(isInvestigationId, "must use a kebab-case Investigation ID with .md")
);
const investigationTagSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(isInvestigationTag, "must use a kebab-case tag")
);
const investigationResourceIdSchema = v.pipe(
  v.string("must be a string"),
  v.check(isInvestigationResourceId, "must be a safe report-owned resource id")
);
const relationSchema = v.strictObject({
  target: investigationIdSchema,
  type: v.picklist(
    investigationRelationTypes,
    "must be a supported investigation relation type"
  )
});
const investigationIndexStateSchema = v.strictObject({
  formedAt: v.pipe(
    nonEmptyStringSchema,
    v.check(
      (value) => investigationTimestampMilliseconds(value) !== null,
      "must be an RFC 3339 timestamp with timezone and second precision"
    )
  ),
  question: nonEmptyStringSchema,
  relations: v.pipe(
    v.array(relationSchema, "must be an array"),
    v.check(
      (relations) =>
        relations.every((relation, index) => {
          const previous = relations[index - 1];
          return (
            previous === undefined ||
            compareCanonicalRelations(previous, relation) < 0
          );
        }),
      "must contain unique relations sorted by type then target"
    )
  ),
  resourceIds: v.pipe(
    v.array(investigationResourceIdSchema, "must be an array"),
    v.check(
      isStrictlySortedText,
      "must contain unique resource ids in sorted order"
    )
  ),
  tags: v.pipe(
    v.array(investigationTagSchema, "must be an array"),
    v.minLength(1, "must contain at least one tag"),
    v.check(isStrictlySortedText, "must contain unique tags in sorted order")
  ),
  title: nonEmptyStringSchema
});
const investigationIndexMetadataSchema = v.strictObject({});
const sourceFingerprintSchema = v.pipe(
  v.string("must be a string"),
  v.regex(
    new RegExp(investigationSourceFingerprintPatternSource, "u"),
    "must be a sha256 investigation source fingerprint"
  )
);
const investigationSourceRevisionSchema = createStateSourceRevisionSchema({
  fingerprint: sourceFingerprintSchema,
  id: investigationIdSchema
});

export function createInvestigationStateIndexDefinition(
  options: {
    snapshot?: StateSnapshot<
      InvestigationIndexState,
      InvestigationIndexMetadata
    >;
  } = {}
): StateIndexDefinition<InvestigationIndexState, InvestigationIndexMetadata> {
  const snapshot = options.snapshot;
  return defineStateIndexDefinition({
    definitionVersion: investigationIndexDefinitionVersion,
    keyStrategies: [
      {
        derive: (state) => state.tags,
        mode: "exact",
        name: "tag"
      },
      {
        derive: (state) =>
          investigationTimestampMilliseconds(state.formedAt) ?? undefined,
        mode: "range",
        name: "formed-at"
      },
      {
        derive: (state) => state.relations.map((relation) => relation.type),
        mode: "exact",
        name: "relation-type"
      },
      {
        derive: (state) => [state.title, state.question],
        mode: "text",
        name: "text"
      }
    ],
    namespace: investigationIndexNamespace,
    parseMetadata: parseInvestigationIndexMetadata,
    parseState: parseInvestigationIndexState,
    read:
      snapshot === undefined
        ? async (context) =>
            await readInvestigationStateSnapshot(context.root, context.signal)
        : async () => snapshot,
    readRevision: async (context) =>
      await readInvestigationSourceRevision(context.root, context.signal),
    validateIndex: validateInvestigationIndex
  });
}

function validateInvestigationIndex(
  index: ReadonlyStateIndex<InvestigationIndexState, InvestigationIndexMetadata>
): void {
  const parsed = v.safeParse(
    investigationSourceRevisionSchema,
    index.sourceRevision
  );
  if (!parsed.success) {
    throw new TypeError(
      parsed.issues.map(formatInvestigationIndexIssue).join("; ")
    );
  }
}

function parseInvestigationIndexMetadata(
  input: Parameters<
    StateIndexDefinition<
      InvestigationIndexState,
      InvestigationIndexMetadata
    >["parseMetadata"]
  >[0]
): InvestigationIndexMetadata {
  const parsed = v.safeParse(investigationIndexMetadataSchema, input);
  if (!parsed.success) {
    throw new TypeError(
      "metadata " + parsed.issues.map(formatInvestigationIndexIssue).join("; ")
    );
  }
  return parsed.output;
}

function parseInvestigationIndexState(
  input: Parameters<
    StateIndexDefinition<
      InvestigationIndexState,
      InvestigationIndexMetadata
    >["parseState"]
  >[0],
  context: Parameters<
    StateIndexDefinition<
      InvestigationIndexState,
      InvestigationIndexMetadata
    >["parseState"]
  >[1]
): InvestigationIndexState {
  const parsed = v.safeParse(investigationIndexStateSchema, input);
  if (!parsed.success) {
    throw new TypeError(
      parsed.issues.map(formatInvestigationIndexIssue).join("; ")
    );
  }
  if (!isInvestigationId(context.id)) {
    throw new TypeError("state id must use a valid Investigation ID");
  }
  return parsed.output;
}

function compareCanonicalRelations(
  left: InvestigationRelation,
  right: InvestigationRelation
): number {
  return (
    investigationRelationTypes.indexOf(left.type) -
      investigationRelationTypes.indexOf(right.type) ||
    (left.target < right.target ? -1 : left.target > right.target ? 1 : 0)
  );
}

function isStrictlySortedText(values: string[]): boolean {
  return values.every((value, index) => {
    const previous = values[index - 1];
    return previous === undefined || previous < value;
  });
}

function formatInvestigationIndexIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath} ${issue.message}`;
}
