import {
  decisionIdPatternSource,
  decisionKebabCaseIdPatternSource,
  decisionSourcePathPatternSource
} from "./decision-path.ts";
import {
  decisionIndexDefinitionVersion,
  decisionIndexNamespace
} from "./decision-index-definition.ts";
import {
  projectionMaximumLength,
  projectionMinimumLength
} from "./projection.ts";
import { relationSummaryMaximumLength } from "./relation-summary.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  establishedDecisionStatuses
} from "./types.ts";
import { decisionTimestampPatternSource } from "./decision-timestamp.ts";
import { decisionSourceFingerprintPatternSource } from "./decision-source-revision.ts";

const projectionText = {
  maxLength: projectionMaximumLength,
  minLength: projectionMinimumLength,
  pattern: "^[^\\r\\n]+$",
  type: "string"
} as const;
const decisionId = {
  pattern: decisionIdPatternSource,
  type: "string"
} as const;
const decisionSourcePath = {
  pattern: decisionSourcePathPatternSource,
  type: "string"
} as const;
const tag = {
  pattern: decisionKebabCaseIdPatternSource,
  type: "string"
} as const;

export const decisionIndexJsonSchema = {
  $comment:
    "entry Decision ID、state.sourcePath、sourceRevision 与 Markdown 投影的一致性由 CLI check 检查。",
  $defs: {
    decisionId,
    decisionSourcePath,
    fingerprint: {
      pattern: decisionSourceFingerprintPatternSource,
      type: "string"
    },
    relation: {
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        type: { enum: decisionRelationTypes, type: "string" },
        target: { $ref: "#/$defs/decisionId" },
        summary: {
          maxLength: relationSummaryMaximumLength,
          pattern: "^[^\\r\\n]+$",
          type: "string"
        }
      },
      required: ["type", "target"],
      type: "object"
    },
    state: {
      additionalProperties: false,
      properties: {
        name: { minLength: 1, pattern: "\\S", type: "string" },
        sourcePath: { $ref: "#/$defs/decisionSourcePath" },
        title: projectionText,
        status: { enum: establishedDecisionStatuses, type: "string" },
        alignment: { enum: decisionAlignments, type: "string" },
        createdAt: {
          pattern: decisionTimestampPatternSource,
          type: "string"
        },
        purpose: projectionText,
        background: projectionText,
        decision: projectionText,
        tags: {
          items: tag,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        relations: {
          items: { $ref: "#/$defs/relation" },
          type: "array",
          uniqueItems: true
        }
      },
      required: [
        "sourcePath",
        "name",
        "title",
        "status",
        "alignment",
        "createdAt",
        "purpose",
        "background",
        "decision",
        "tags",
        "relations"
      ],
      type: "object"
    }
  },
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  description: "由决策 Markdown 生成的决策状态通用索引。",
  properties: {
    schemaVersion: { const: 4 },
    namespace: { const: decisionIndexNamespace },
    definitionVersion: { const: decisionIndexDefinitionVersion },
    metadata: {
      additionalProperties: false,
      properties: {},
      type: "object"
    },
    sourceRevision: {
      additionalProperties: false,
      properties: {
        metadata: { $ref: "#/$defs/fingerprint" },
        entries: {
          additionalProperties: { $ref: "#/$defs/fingerprint" },
          propertyNames: { $ref: "#/$defs/decisionId" },
          type: "object"
        }
      },
      required: ["metadata", "entries"],
      type: "object"
    },
    entries: {
      additionalProperties: { $ref: "#/$defs/state" },
      propertyNames: { $ref: "#/$defs/decisionId" },
      type: "object"
    }
  },
  required: [
    "schemaVersion",
    "namespace",
    "definitionVersion",
    "metadata",
    "sourceRevision",
    "entries"
  ],
  title: "Decision Records State Index",
  type: "object"
} as const;
