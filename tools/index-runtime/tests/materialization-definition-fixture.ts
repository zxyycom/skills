import { defineStateIndexDefinition } from "../src/index.ts";

export type SemanticDefinitionCalls = {
  metadataParses: number;
  parses: number;
  revisionReads: number;
  validations: number;
};

export function createSemanticDefinition(calls: SemanticDefinitionCalls) {
  return defineStateIndexDefinition<{
    sourcePath: string;
    title: string;
    status: string;
    summary: { purpose: string; background: string };
  }>({
    definitionVersion: 1,
    fieldOrder: "definition",
    queryFields: [
      {
        mode: "exact",
        name: "topic",
        sources: [{ kind: "source-path-first-segment" }]
      },
      {
        mode: "exact",
        name: "status",
        sources: [{ kind: "state-path", path: ["status"] }]
      }
    ],
    namespace: "semantic-order",
    parseMetadata: (metadata) => {
      calls.metadataParses += 1;
      return metadata;
    },
    parseState: (input) => {
      calls.parses += 1;
      const summary = input.summary;
      if (
        typeof input.sourcePath !== "string" ||
        typeof input.title !== "string" ||
        typeof input.status !== "string" ||
        summary === null ||
        typeof summary !== "object" ||
        Array.isArray(summary) ||
        typeof summary.purpose !== "string" ||
        typeof summary.background !== "string"
      )
        throw new TypeError("invalid semantic state");
      return {
        sourcePath: input.sourcePath,
        title: input.title,
        status: input.status,
        summary: { purpose: summary.purpose, background: summary.background }
      };
    },
    read: async () => ({
      metadata: {},
      sourceRevision: {
        entries: {
          "topic/a.md": "semantic-a-revision-1",
          "topic/z.md": "semantic-z-revision-1"
        },
        metadata: "semantic-metadata-revision-1"
      },
      states: {
        "topic/z.md": {
          sourcePath: "topic/z.md",
          status: "active",
          summary: { background: "B", purpose: "P" },
          title: "Z"
        },
        "topic/a.md": {
          sourcePath: "topic/a.md",
          status: "active",
          summary: { background: "B", purpose: "P" },
          title: "A"
        }
      }
    }),
    readRevision: async () => {
      calls.revisionReads += 1;
      return {
        entries: {
          "topic/a.md": "semantic-a-revision-1",
          "topic/z.md": "semantic-z-revision-1"
        },
        metadata: "semantic-metadata-revision-1"
      };
    },
    validateIndex: () => {
      calls.validations += 1;
    }
  });
}
