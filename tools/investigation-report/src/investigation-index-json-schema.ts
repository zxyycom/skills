import {
  investigationIndexDefinitionVersion,
  investigationIndexNamespace
} from "./investigation-index-definition.ts";
import {
  investigationKebabCasePatternSource,
  investigationTopicPathPatternSource
} from "./report-path.ts";
import { investigationResourceIdLexicalPatternSource } from "./resource-reference.ts";
import { investigationSourceFingerprintPatternSource } from "./investigation-source-revision.ts";
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
  $comment:
    "entry 对象键、state.path、派生 keys、资源排序与交叉引用、sourceRevision 与调查事实源的一致性由调查报告 CLI 检查。",
  $defs: {
    fingerprint: {
      pattern: investigationSourceFingerprintPatternSource,
      type: "string"
    },
    resourceId: {
      $comment:
        "pattern 表达路径段字符白名单、非空路径段和正斜杠分隔；路径段首尾点、至少一个汉字、ASCII 英文字母或 ASCII 数字、Windows 保留设备名和 ASCII 括号平衡由调查报告 CLI 补充校验。",
      pattern: investigationResourceIdLexicalPatternSource,
      type: "string"
    },
    resourceReference: {
      additionalProperties: false,
      properties: {
        reportIndex: {
          minimum: 0,
          type: "integer"
        },
        resourceIds: {
          items: { $ref: "#/$defs/resourceId" },
          minItems: 1,
          type: "array",
          uniqueItems: true
        }
      },
      required: ["reportIndex", "resourceIds"],
      type: "object"
    },
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
        resourceReferences: {
          items: { $ref: "#/$defs/resourceReference" },
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
        "resourceReferences",
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
      additionalProperties: {
        additionalProperties: false,
        properties: {
          keys: { $ref: "#/$defs/keyValues" },
          state: { $ref: "#/$defs/state" }
        },
        required: ["keys", "state"],
        type: "object"
      },
      propertyNames: { $ref: "#/$defs/topicPath" },
      type: "object"
    },
    keyDefinitions: {
      const: [
        { mode: "exact", name: "category" },
        { mode: "range", name: "latest-report-at" },
        { mode: "exact", name: "status" },
        { mode: "text", name: "text" }
      ]
    },
    metadata: {
      additionalProperties: false,
      type: "object"
    },
    namespace: { const: investigationIndexNamespace },
    schemaVersion: { const: 3 },
    sourceRevision: {
      additionalProperties: false,
      properties: {
        metadata: { $ref: "#/$defs/fingerprint" },
        entries: {
          additionalProperties: { $ref: "#/$defs/fingerprint" },
          propertyNames: { $ref: "#/$defs/topicPath" },
          type: "object"
        }
      },
      required: ["metadata", "entries"],
      type: "object"
    }
  },
  required: [
    "definitionVersion",
    "entries",
    "keyDefinitions",
    "metadata",
    "namespace",
    "schemaVersion",
    "sourceRevision"
  ],
  title: "Investigation Topic State Index",
  type: "object"
} as const;
