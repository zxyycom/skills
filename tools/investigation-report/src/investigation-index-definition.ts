import * as v from "valibot";
import {
  createStateSourceRevisionSchema,
  defineStateIndexDefinition,
  type ReadonlyStateIndex,
  type StateIndexDefinition
} from "../../index-runtime/src/index.ts";
import {
  readInvestigationSourceRevision,
  readInvestigationStateSnapshot
} from "./investigation-index-source.ts";
import { investigationSourceFingerprintPatternSource } from "./investigation-source-revision.ts";
import {
  isInvestigationTopicPath,
  investigationCategoryOf
} from "./report-path.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  investigationIndexMetadata,
  investigationReportStatuses,
  type InvestigationIndexMetadata,
  type InvestigationIndexState
} from "./types.ts";

export const investigationIndexNamespace = "investigations";
export const investigationIndexDefinitionVersion = 2;

const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check(
    (value) => value.length > 0 && value.trim() === value,
    "must be non-empty text without surrounding whitespace"
  )
);
const investigationTopicPathSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(
    isInvestigationTopicPath,
    "must use <category-id>/<semantic-slug>.md"
  )
);
const investigationIndexStateSchema = v.strictObject({
  latestReportAt: v.pipe(
    nonEmptyStringSchema,
    v.check(
      (value) => investigationTimestampMilliseconds(value) !== null,
      "must be an RFC 3339 timestamp with timezone and second precision"
    )
  ),
  path: investigationTopicPathSchema,
  question: nonEmptyStringSchema,
  reportCount: v.pipe(
    v.number("must be a number"),
    v.integer("must be an integer"),
    v.minValue(1, "must be at least 1")
  ),
  reportTitles: v.pipe(
    v.array(nonEmptyStringSchema, "must be an array"),
    v.minLength(1, "must contain at least one report title")
  ),
  status: v.picklist(investigationReportStatuses),
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
  id: investigationTopicPathSchema
});

export function createInvestigationStateIndexDefinition(
): StateIndexDefinition<
  InvestigationIndexState,
  InvestigationIndexMetadata
> {
  return defineStateIndexDefinition({
    definitionVersion: investigationIndexDefinitionVersion,
    keyStrategies: [
      {
        derive: (state) => investigationTimestampMilliseconds(
          state.latestReportAt
        ) ?? undefined,
        mode: "range",
        name: "latest-report-at"
      },
      {
        derive: (state) => state.status,
        mode: "exact",
        name: "status"
      },
      {
        derive: (state) => [
          state.title,
          state.question,
          ...state.reportTitles
        ],
        mode: "text",
        name: "text"
      },
      {
        derive: (_state, context) => (
          investigationCategoryOf(context.id) ?? undefined
        ),
        mode: "exact",
        name: "category"
      }
    ],
    namespace: investigationIndexNamespace,
    parseMetadata: parseInvestigationIndexMetadata,
    parseState: parseInvestigationIndexState,
    read: async (context) => await readInvestigationStateSnapshot(
      context.root,
      context.signal
    ),
    readRevision: async (context) => await readInvestigationSourceRevision(
      context.root,
      context.signal
    ),
    validateIndex: validateInvestigationSourceRevision
  });
}

function validateInvestigationSourceRevision(
  index: ReadonlyStateIndex<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >
): void {
  const parsed = v.safeParse(
    investigationSourceRevisionSchema,
    index.sourceRevision
  );
  if (!parsed.success) {
    throw new TypeError(parsed.issues.map(formatInvestigationIndexIssue).join("; "));
  }
}

function parseInvestigationIndexMetadata(
  input: Parameters<StateIndexDefinition<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >["parseMetadata"]>[0]
): InvestigationIndexMetadata {
  v.parse(investigationIndexMetadataSchema, input);
  return investigationIndexMetadata;
}

function parseInvestigationIndexState(input: Parameters<
  StateIndexDefinition<
    InvestigationIndexState,
    InvestigationIndexMetadata
  >["parseState"]
>[0], context: Parameters<StateIndexDefinition<
  InvestigationIndexState,
  InvestigationIndexMetadata
>["parseState"]>[1]): InvestigationIndexState {
  const parsed = v.safeParse(investigationIndexStateSchema, input);
  if (!parsed.success) {
    throw new TypeError(
      parsed.issues.map(formatInvestigationIndexIssue).join("; ")
    );
  }
  if (parsed.output.reportCount !== parsed.output.reportTitles.length) {
    throw new TypeError(
      "reportCount must equal the number of reportTitles"
    );
  }
  if (parsed.output.path !== context.id) {
    throw new TypeError("state.path must equal the entry id");
  }
  return parsed.output;
}

function formatInvestigationIndexIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath} ${issue.message}`;
}
