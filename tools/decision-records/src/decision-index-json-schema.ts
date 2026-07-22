import { decisionRelativePathPatternSource } from "./decision-path.ts";
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

export const decisionIndexJsonSchema = {
  $comment: "集合级路径唯一性、路径排序、Markdown 投影一致性和关系图约束由 CLI check 检查。",
  $defs: {
    decisionPath: {
      description: "主题目录下的稳定决策 Markdown 相对路径。",
      pattern: decisionRelativePathPatternSource,
      type: "string"
    },
    projectionText: {
      description: "单行索引投影文本。",
      maxLength: projectionMaximumLength,
      minLength: projectionMinimumLength,
      pattern: "^[^\\r\\n]+$",
      type: "string"
    },
    record: {
      additionalProperties: false,
      allOf: [
        {
          if: {
            properties: { status: { const: "active" } },
            required: ["status"]
          },
          then: {
            properties: {
              alignment: { enum: decisionAlignments }
            }
          }
        },
        {
          if: {
            properties: { status: { const: "archived" } },
            required: ["status"]
          },
          then: {
            properties: {
              alignment: { const: null }
            }
          }
        }
      ],
      properties: {
        alignment: {
          description: "活动决策目标是否已核对并建立为单向基线；归档决策固定为 null。",
          enum: [...decisionAlignments, null],
          type: ["string", "null"]
        },
        background: { $ref: "#/$defs/projectionText" },
        createdAt: {
          description: "精确到秒且带显式时区的 RFC 3339 时间。",
          pattern: decisionTimestampPatternSource,
          type: "string"
        },
        decision: { $ref: "#/$defs/projectionText" },
        path: { $ref: "#/$defs/decisionPath" },
        purpose: { $ref: "#/$defs/projectionText" },
        relations: {
          items: { $ref: "#/$defs/relation" },
          type: "array",
          uniqueItems: true
        },
        status: {
          enum: decisionStatuses,
          type: "string"
        },
        title: { $ref: "#/$defs/projectionText" }
      },
      required: [
        "path",
        "status",
        "alignment",
        "createdAt",
        "title",
        "purpose",
        "background",
        "decision",
        "relations"
      ],
      type: "object"
    },
    relation: {
      additionalProperties: false,
      properties: {
        target: { $ref: "#/$defs/decisionPath" },
        type: {
          enum: decisionRelationTypes,
          type: "string"
        }
      },
      required: ["type", "target"],
      type: "object"
    }
  },
  $schema: "https://json-schema.org/draft/2020-12/schema",
  additionalProperties: false,
  description: "由自包含决策 Markdown 生成的 decision-records schema v4 全生命周期索引。",
  properties: {
    records: {
      items: { $ref: "#/$defs/record" },
      type: "array"
    },
    schemaVersion: { const: 4 }
  },
  required: ["schemaVersion", "records"],
  title: "Decision Records Index",
  type: "object"
} as const;
