import { decisionRelativePathPatternSource } from "./decision-path.ts";
import {
  decisionIndexDefinitionVersion,
  decisionIndexNamespace
} from "./decision-state-index.ts";
import {
  projectionMaximumLength,
  projectionMinimumLength
} from "./projection.ts";
import {
  decisionAlignments,
  decisionRelationTypes,
  decisionStatuses
} from "./types.ts";
import { decisionTimestampPatternSource } from "./decision-timestamp.ts";

const projectionText = {
  maxLength: projectionMaximumLength,
  minLength: projectionMinimumLength,
  pattern: "^[^\\r\\n]+$",
  type: "string"
} as const;
const decisionPath = {
  pattern: decisionRelativePathPatternSource,
  type: "string"
} as const;

export const decisionIndexJsonSchema = {
  $comment: "id、state.path、派生 keys、sourceRevision 与 Markdown 投影的一致性由 CLI check 检查。",
  $defs: {
    decisionPath,
    keyValues: {
      additionalProperties: false,
      properties: {
        alignment: {
          items: { enum: decisionAlignments, type: "string" },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        status: {
          items: { enum: decisionStatuses, type: "string" },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        topic: {
          items: {
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            type: "string"
          },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        }
      },
      required: ["status", "topic"],
      type: "object"
    },
    relation: {
      additionalProperties: false,
      properties: {
        target: { $ref: "#/$defs/decisionPath" },
        type: { enum: decisionRelationTypes, type: "string" }
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
        },
        {
          if: {
            properties: { status: { const: "archived" } },
            required: ["status"]
          },
          then: {
            properties: { alignment: { const: null } }
          }
        }
      ],
      properties: {
        alignment: {
          enum: [...decisionAlignments, null],
          type: ["string", "null"]
        },
        background: projectionText,
        createdAt: {
          pattern: decisionTimestampPatternSource,
          type: "string"
        },
        decision: projectionText,
        path: { $ref: "#/$defs/decisionPath" },
        purpose: projectionText,
        relations: {
          items: { $ref: "#/$defs/relation" },
          type: "array",
          uniqueItems: true
        },
        status: { enum: decisionStatuses, type: "string" },
        title: projectionText
      },
      required: [
        "alignment",
        "background",
        "createdAt",
        "decision",
        "path",
        "purpose",
        "relations",
        "status",
        "title"
      ],
      type: "object"
    }
  },
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  description: "由决策 Markdown 生成的领域状态通用索引。",
  properties: {
    definitionVersion: { const: decisionIndexDefinitionVersion },
    entries: {
      items: {
        additionalProperties: false,
        properties: {
          id: { $ref: "#/$defs/decisionPath" },
          keys: { $ref: "#/$defs/keyValues" },
          state: { $ref: "#/$defs/state" }
        },
        required: ["id", "keys", "state"],
        type: "object"
      },
      type: "array"
    },
    keyDefinitions: {
      const: [
        { mode: "exact", name: "alignment" },
        { mode: "exact", name: "status" },
        { mode: "exact", name: "topic" }
      ]
    },
    namespace: { const: decisionIndexNamespace },
    schemaVersion: { const: 1 },
    sourceRevision: {
      pattern: "^sha256:[0-9a-f]{64}$",
      type: "string"
    }
  },
  required: [
    "definitionVersion",
    "entries",
    "keyDefinitions",
    "namespace",
    "schemaVersion",
    "sourceRevision"
  ],
  title: "Decision Records State Index",
  type: "object"
} as const;
