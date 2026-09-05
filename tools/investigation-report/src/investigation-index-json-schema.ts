import {
  investigationIndexDefinitionVersion,
  investigationIndexNamespace
} from "./investigation-index-definition.ts";
import {
  investigationIdPatternSource,
  investigationKebabCasePatternSource,
  investigationSourcePathPatternSource
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
    "entry 对象键、资源排序、关系图、sourceRevision 与报告 Markdown 的一致性由调查报告 CLI 检查。",
  $defs: {
    fingerprint: {
      pattern: investigationSourceFingerprintPatternSource,
      type: "string"
    },
    investigationId,
    sourcePath: {
      pattern: investigationSourcePathPatternSource,
      type: "string"
    },
    relation: {
      additionalProperties: false,
      properties: {
        target: { $ref: "#/$defs/investigationId" },
        type: { enum: investigationRelationTypes, type: "string" },
        summary: {
          maxLength: 40,
          minLength: 1,
          pattern: "^(?!\\s)(?!.*[\\r\\n])[\\s\\S]*\\S$",
          type: "string"
        }
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
    state: {
      additionalProperties: false,
      properties: {
        formedAt: {
          pattern: investigationTimestampPatternSource,
          type: "string"
        },
        name: nonEmptyText,
        question: nonEmptyText,
        relations: { items: { $ref: "#/$defs/relation" }, type: "array" },
        resourceIds: {
          items: { $ref: "#/$defs/resourceId" },
          type: "array",
          uniqueItems: true
        },
        sourcePath: { $ref: "#/$defs/sourcePath" },
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
        "name",
        "question",
        "tags",
        "relations",
        "resourceIds",
        "sourcePath"
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
      additionalProperties: { $ref: "#/$defs/state" },
      propertyNames: { $ref: "#/$defs/investigationId" },
      type: "object"
    },
    metadata: { additionalProperties: false, type: "object" },
    namespace: { const: investigationIndexNamespace },
    schemaVersion: { const: 4 },
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
    "metadata",
    "namespace",
    "schemaVersion",
    "sourceRevision"
  ],
  title: "Investigation Report State Index",
  type: "object"
} as const;
