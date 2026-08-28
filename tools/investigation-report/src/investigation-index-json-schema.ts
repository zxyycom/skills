import {
  investigationIndexDefinitionVersion,
  investigationIndexNamespace
} from "./investigation-index-definition.ts";
import {
  investigationIdPatternSource,
  investigationKebabCasePatternSource
} from "./report-path.ts";
import { investigationResourceIdLexicalPatternSource } from "./resource-reference.ts";
import { investigationSourceFingerprintPatternSource } from "./investigation-source-revision.ts";
import { investigationTimestampPatternSource } from "./timestamp.ts";
import { investigationRelationTypes } from "./types.ts";

const nonEmptyText = {
  minLength: 1,
  pattern: "^(?!\\s)(?:[^\\u0000-\\u001f\\u007f]*\\S)?$",
  type: "string"
} as const;
const investigationId = {
  pattern: investigationIdPatternSource,
  type: "string"
} as const;

export const investigationIndexJsonSchema = {
  $comment:
    "entry 对象键、派生 keys、资源排序、关系图、sourceRevision 与报告 Markdown 的一致性由调查报告 CLI 检查。",
  $defs: {
    fingerprint: {
      pattern: investigationSourceFingerprintPatternSource,
      type: "string"
    },
    investigationId,
    relation: {
      additionalProperties: false,
      properties: {
        target: { $ref: "#/$defs/investigationId" },
        type: { enum: investigationRelationTypes, type: "string" }
      },
      required: ["type", "target"],
      type: "object"
    },
    resourceId: {
      $comment:
        "pattern 表达路径段字符白名单、非空路径段和正斜杠分隔；owner Investigation ID、路径段首尾点、至少一个身份字符、Windows 保留设备名和 Markdown 括号平衡由调查报告 CLI 补充校验。",
      pattern: investigationResourceIdLexicalPatternSource,
      type: "string"
    },
    keyValues: {
      additionalProperties: false,
      properties: {
        "formed-at": {
          items: { type: "integer" },
          maxItems: 1,
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        "relation-type": {
          items: { enum: investigationRelationTypes, type: "string" },
          type: "array",
          uniqueItems: true
        },
        tag: {
          items: {
            pattern: `^${investigationKebabCasePatternSource}$`,
            type: "string"
          },
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
      required: ["tag", "formed-at", "relation-type", "text"],
      type: "object"
    },
    state: {
      additionalProperties: false,
      properties: {
        formedAt: {
          pattern: investigationTimestampPatternSource,
          type: "string"
        },
        question: nonEmptyText,
        relations: { items: { $ref: "#/$defs/relation" }, type: "array" },
        resourceIds: {
          items: { $ref: "#/$defs/resourceId" },
          type: "array",
          uniqueItems: true
        },
        tags: {
          items: {
            pattern: `^${investigationKebabCasePatternSource}$`,
            type: "string"
          },
          minItems: 1,
          type: "array",
          uniqueItems: true
        },
        title: nonEmptyText
      },
      required: [
        "title",
        "formedAt",
        "question",
        "tags",
        "relations",
        "resourceIds"
      ],
      type: "object"
    }
  },
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  description: "由单份调查报告 Markdown 生成的领域状态通用索引。",
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
      propertyNames: { $ref: "#/$defs/investigationId" },
      type: "object"
    },
    keyDefinitions: {
      const: [
        { mode: "exact", name: "tag" },
        { mode: "range", name: "formed-at" },
        { mode: "exact", name: "relation-type" },
        { mode: "text", name: "text" }
      ]
    },
    metadata: { additionalProperties: false, type: "object" },
    namespace: { const: investigationIndexNamespace },
    schemaVersion: { const: 3 },
    sourceRevision: {
      additionalProperties: false,
      properties: {
        metadata: { $ref: "#/$defs/fingerprint" },
        entries: {
          additionalProperties: { $ref: "#/$defs/fingerprint" },
          propertyNames: { $ref: "#/$defs/investigationId" },
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
  title: "Investigation Report State Index",
  type: "object"
} as const;
