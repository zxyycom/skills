import {
  investigationIndexDefinitionVersion,
  investigationIndexNamespace
} from "./investigation-state-index.ts";
import {
  investigationKebabCasePatternSource,
  investigationTopicPathPatternSource
} from "./report-path.ts";
import { investigationTimestampPatternSource } from "./timestamp.ts";
import { investigationReportStatuses } from "./types.ts";

const nonEmptyText = {
  minLength: 1,
  pattern: "^(?!\\s)(?:[^\\u0000-\\u001f\\u007f]*\\S)?$",
  type: "string"
} as const;
const topicPath = {
  pattern: investigationTopicPathPatternSource,
  type: "string"
} as const;

export const investigationIndexJsonSchema = {
  $comment: "id、state.path、派生 keys、sourceRevision 与调查 Markdown 投影的一致性由调查报告 CLI 检查。",
  $defs: {
    keyValues: {
      additionalProperties: false,
      properties: {
        category: {
          items: {
            pattern: `^${investigationKebabCasePatternSource}$`,
            type: "string"
          },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        "latest-report-at": {
          items: {
            type: "integer"
          },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        status: {
          items: {
            enum: investigationReportStatuses,
            type: "string"
          },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        text: {
          items: nonEmptyText,
          minItems: 1,
          type: "array",
          uniqueItems: true
        }
      },
      required: ["category", "latest-report-at", "status", "text"],
      type: "object"
    },
    topicPath,
    state: {
      additionalProperties: false,
      properties: {
        latestReportAt: {
          pattern: investigationTimestampPatternSource,
          type: "string"
        },
        path: { $ref: "#/$defs/topicPath" },
        question: nonEmptyText,
        reportCount: {
          minimum: 1,
          type: "integer"
        },
        reportTitles: {
          items: nonEmptyText,
          minItems: 1,
          type: "array"
        },
        status: {
          enum: investigationReportStatuses,
          type: "string"
        },
        title: nonEmptyText
      },
      required: [
        "latestReportAt",
        "path",
        "question",
        "reportCount",
        "reportTitles",
        "status",
        "title"
      ],
      type: "object"
    }
  },
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  description: "由调查主题 Markdown 生成的领域状态通用索引。",
  properties: {
    definitionVersion: { const: investigationIndexDefinitionVersion },
    entries: {
      items: {
        additionalProperties: false,
        properties: {
          id: { $ref: "#/$defs/topicPath" },
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
        { mode: "exact", name: "category" },
        { mode: "range", name: "latest-report-at" },
        { mode: "exact", name: "status" },
        { mode: "text", name: "text" }
      ]
    },
    namespace: { const: investigationIndexNamespace },
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
  title: "Investigation Topic State Index",
  type: "object"
} as const;
