import {
  decisionKebabCaseIdPatternSource,
  decisionRelativePathPatternSource
} from "./decision-path.ts";
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
  establishedDecisionStatuses
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
const decisionDomainId = {
  pattern: decisionKebabCaseIdPatternSource,
  type: "string"
} as const;

export const decisionIndexJsonSchema = {
  $comment: "id、state.path、派生 keys、sourceRevision 与 Markdown 投影的一致性由 CLI check 检查。",
  $defs: {
    decisionPath,
    domainDefinition: {
      additionalProperties: false,
      properties: {
        id: decisionDomainId,
        description: {
          maxLength: 200,
          minLength: 4,
          pattern: "^[^\\r\\n]+$",
          type: "string"
        }
      },
      required: ["id", "description"],
      type: "object"
    },
    keyValues: {
      additionalProperties: false,
      properties: {
        domain: {
          items: {
            ...decisionDomainId
          },
          maxItems: 1,
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
      required: ["domain", "status"],
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
        }
      ],
      properties: {
        path: { $ref: "#/$defs/decisionPath" },
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
  description: "由决策 Markdown 生成的决策状态通用索引。",
  properties: {
    schemaVersion: { const: 2 },
    namespace: { const: decisionIndexNamespace },
    definitionVersion: { const: decisionIndexDefinitionVersion },
    metadata: {
      additionalProperties: false,
      properties: {
        domains: {
          items: { $ref: "#/$defs/domainDefinition" },
          minItems: 1,
          type: "array",
          uniqueItems: true
        }
      },
      required: ["domains"],
      type: "object"
    },
    sourceRevision: {
      pattern: "^sha256:[0-9a-f]{64}$",
      type: "string"
    },
    keyDefinitions: {
      const: [
        { name: "domain", mode: "exact" },
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
    "metadata",
    "sourceRevision",
    "keyDefinitions",
    "entries"
  ],
  title: "Decision Records State Index",
  type: "object"
} as const;
