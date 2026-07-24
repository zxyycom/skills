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
        topic: {
          items: {
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            type: "string"
          },
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
        alignment: {
          items: { enum: decisionAlignments, type: "string" },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        }
      },
      required: ["topic", "status"],
      type: "object"
    },
    relation: {
      additionalProperties: false,
      properties: {
        type: { enum: decisionRelationTypes, type: "string" },
        target: { $ref: "#/$defs/decisionPath" }
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
        path: { $ref: "#/$defs/decisionPath" },
        title: projectionText,
        status: { enum: decisionStatuses, type: "string" },
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
        relations: {
          items: { $ref: "#/$defs/relation" },
          type: "array",
          uniqueItems: true
        }
      },
      required: [
        "path",
        "title",
        "status",
        "alignment",
        "createdAt",
        "purpose",
        "background",
        "decision",
        "relations"
      ],
      type: "object"
    }
  },
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  description: "由决策 Markdown 生成的领域状态通用索引。",
  properties: {
    schemaVersion: { const: 1 },
    namespace: { const: decisionIndexNamespace },
    definitionVersion: { const: decisionIndexDefinitionVersion },
    sourceRevision: {
      pattern: "^sha256:[0-9a-f]{64}$",
      type: "string"
    },
    keyDefinitions: {
      const: [
        { name: "topic", mode: "exact" },
        { name: "status", mode: "exact" },
        { name: "alignment", mode: "exact" }
      ]
    },
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
    }
  },
  required: [
    "schemaVersion",
    "namespace",
    "definitionVersion",
    "sourceRevision",
    "keyDefinitions",
    "entries"
  ],
  title: "Decision Records State Index",
  type: "object"
} as const;
