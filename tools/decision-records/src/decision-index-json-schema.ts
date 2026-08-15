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
    "entry Decision ID、state.sourcePath、派生 keys、sourceRevision 与 Markdown 投影的一致性由 CLI check 检查。",
  $defs: {
    decisionId,
    decisionSourcePath,
    fingerprint: {
      pattern: decisionSourceFingerprintPatternSource,
      type: "string"
    },
    keyValues: {
      additionalProperties: false,
      properties: {
        tag: {
          items: tag,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        status: {
          items: { enum: establishedDecisionStatuses, type: "string" },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        alignment: {
          items: { enum: decisionAlignments, type: "string" },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        }
      },
      required: ["tag", "status"],
      type: "object"
    },
    relation: {
      additionalProperties: false,
      properties: {
        type: { enum: decisionRelationTypes, type: "string" },
        target: { $ref: "#/$defs/decisionId" }
      },
      required: ["type", "target"],
      type: "object"
    },
    state: {
      additionalProperties: false,
      allOf: [
        {
          if: {
            properties: { status: { const: "active" } },
            required: ["status"]
          },
          then: {
            properties: { alignment: { enum: decisionAlignments } }
          }
        }
      ],
      properties: {
        sourcePath: { $ref: "#/$defs/decisionSourcePath" },
        title: projectionText,
        status: { enum: establishedDecisionStatuses, type: "string" },
        alignment: {
          enum: [...decisionAlignments, null],
          type: ["string", "null"]
        },
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
    schemaVersion: { const: 3 },
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
    keyDefinitions: {
      const: [
        { name: "tag", mode: "exact" },
        { name: "status", mode: "exact" },
        { name: "alignment", mode: "exact" }
      ]
    },
    entries: {
      additionalProperties: {
        additionalProperties: false,
        properties: {
          keys: { $ref: "#/$defs/keyValues" },
          state: { $ref: "#/$defs/state" }
        },
        required: ["keys", "state"],
        type: "object"
      },
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
    "keyDefinitions",
    "entries"
  ],
  title: "Decision Records State Index",
  type: "object"
} as const;
