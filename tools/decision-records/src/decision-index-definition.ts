import * as v from "valibot";
import {
  defineStateIndexDefinition,
  type StateIndexDefinition,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import { decisionDomainDefinitionsSchema } from "./decision-domain-catalog.ts";
import {
  decisionDomainFromRelativePath,
  isDecisionRelativePath
} from "./decision-path.ts";
import {
  decisionIndexState,
  readDecisionSourceRevision,
  readDecisionStateSnapshot
} from "./decision-index-source.ts";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import { projectionTextIssue } from "./projection.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  decisionStatuses,
  type DecisionDocument,
  type DecisionIndexMetadata,
  type DecisionIndexState,
  type DecisionMetadata
} from "./types.ts";

export const decisionIndexNamespace = "decisions";
export const decisionIndexDefinitionVersion = 4;

const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check((value) => value.trim().length > 0, "must be non-empty")
);
const decisionPathSchema = v.pipe(
  nonEmptyStringSchema,
  v.check(isDecisionRelativePath, "must be a decision Markdown path")
);
const decisionRelationSchema = v.strictObject({
  type: v.picklist(decisionRelationTypes),
  target: decisionPathSchema
});
const decisionIndexStateSchema = v.strictObject({
  path: decisionPathSchema,
  title: nonEmptyStringSchema,
  status: v.picklist(decisionStatuses),
  alignment: v.union([v.picklist(decisionAlignments), v.null()]),
  createdAt: nonEmptyStringSchema,
  purpose: nonEmptyStringSchema,
  background: nonEmptyStringSchema,
  decision: nonEmptyStringSchema,
  relations: v.array(decisionRelationSchema)
});
const decisionIndexMetadataSchema = v.strictObject({
  domains: decisionDomainDefinitionsSchema
});

type DecisionIndexDefinitionOptions = {
  relativePaths?: readonly string[];
};

export function createDecisionStateIndexDefinition(
  options: DecisionIndexDefinitionOptions = {}
): StateIndexDefinition<DecisionIndexState, DecisionIndexMetadata> {
  const relativePaths = options.relativePaths;
  return defineStateIndexDefinition({
    definitionVersion: decisionIndexDefinitionVersion,
    fieldOrder: "definition",
    identify: (state) => state.path,
    keyStrategies: [
      {
        derive: (state, context) => decisionDomainFromIndexPath(
          state.path,
          context.metadata
        ),
        mode: "exact",
        name: "domain"
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
    read: relativePaths === undefined
      ? unavailableRead
      : async (context) => await readDecisionStateSnapshot(
        context.root,
        relativePaths,
        context.signal
      ),
    readRevision: relativePaths === undefined
      ? unavailableRevisionRead
      : async (context) => await readDecisionSourceRevision(
        context.root,
        relativePaths,
        context.signal
      )
  });
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
    throw new TypeError(parsed.issues.map(formatDecisionStateIssue).join("; "));
  }

  const state = parsed.output;
  decisionDomainFromIndexPath(state.path, context.metadata);
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

  const relationKeys = new Set<string>();
  for (const relation of state.relations) {
    const key = `${relation.type}\u0000${relation.target}`;
    if (relationKeys.has(key)) {
      throw new TypeError(
        `repeats relationship ${relation.type} target ${relation.target}`
      );
    }
    relationKeys.add(key);
  }

  const document: DecisionDocument = metadata.status === "active"
    ? {
        title: state.title,
        status: "active",
        alignment: metadata.alignment,
        createdAt: metadata.createdAt,
        purpose: state.purpose,
        background: state.background,
        decision: state.decision,
        relations: state.relations
      }
    : {
        title: state.title,
        status: "archived",
        alignment: metadata.alignment,
        createdAt: metadata.createdAt,
        purpose: state.purpose,
        background: state.background,
        decision: state.decision,
        relations: state.relations
      };
  return decisionIndexState(state.path, document);
}

function formatDecisionStateIssue(issue: v.BaseIssue<unknown>): string {
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

async function unavailableRead(): Promise<StateSnapshot<
  DecisionIndexState,
  DecisionIndexMetadata
>> {
  throw new Error("decision state reader is unavailable in this operation");
}

async function unavailableRevisionRead(): Promise<string> {
  throw new Error("decision revision reader is unavailable in this operation");
}

function decisionDomainFromIndexPath(
  relativePath: string,
  metadata: {
    readonly domains: readonly {
      readonly id: string;
    }[];
  }
): string {
  const domain = decisionDomainFromRelativePath(relativePath);
  if (domain === null) {
    throw new TypeError(`path must identify a decision domain: ${relativePath}`);
  }
  if (!metadata.domains.some((definition) => definition.id === domain)) {
    throw new TypeError(
      `path domain is not defined in metadata.domains: ${domain}`
    );
  }
  return domain;
}
