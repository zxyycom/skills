import type {
  JsonObject,
  StateIndex,
  StateIndexDefinition
} from "../../src/index.ts";
import { isPlainRecord } from "../../src/protocol/record.ts";

export type ReaderLoadState = {
  formedAt: string;
  label: string;
};

type ReaderLoadMetadata = {
  nested: { limit: number };
};

export function readerLoadFixture() {
  const calls = {
    metadataParses: 0,
    parses: 0,
    reads: 0,
    revisionReads: 0,
    validations: 0
  };
  const control = { rejectCollection: false };
  const parsedStates: ReaderLoadState[] = [];
  const parsedMetadata: ReaderLoadMetadata[] = [];
  const index: StateIndex<ReaderLoadState, ReaderLoadMetadata> = {
    definitionVersion: 1,
    entries: {
      a: { formedAt: "2026-01-01T00:00:00Z", label: "First" },
      b: { formedAt: "2026-01-02T00:00:00Z", label: "Second" }
    },
    metadata: { nested: { limit: 2 } },
    namespace: "reader-load",
    schemaVersion: 4,
    sourceRevision: { entries: { a: "a-1", b: "b-1" }, metadata: "metadata-1" }
  };
  const definition: StateIndexDefinition<ReaderLoadState, ReaderLoadMetadata> =
    {
      definitionVersion: 1,
      namespace: "reader-load",
      parseMetadata: (input) => {
        calls.metadataParses += 1;
        if (
          !isPlainRecord(input.nested) ||
          typeof input.nested.limit !== "number"
        ) {
          throw new TypeError("invalid reader metadata");
        }
        const metadata = { nested: { limit: input.nested.limit } };
        parsedMetadata.push(metadata);
        return metadata;
      },
      parseState: (input) => {
        calls.parses += 1;
        if (
          typeof input.label !== "string" ||
          typeof input.formedAt !== "string"
        ) {
          throw new TypeError("invalid reader state");
        }
        const state = { formedAt: input.formedAt, label: input.label };
        parsedStates.push(state);
        return state;
      },
      queryFields: [
        {
          mode: "range",
          name: "formed-at",
          sources: [
            { kind: "state-path", normalization: "instant", path: ["formedAt"] }
          ]
        }
      ],
      read: async () => {
        calls.reads += 1;
        return {
          metadata: index.metadata,
          sourceRevision: index.sourceRevision,
          states: index.entries
        };
      },
      readRevision: async () => {
        calls.revisionReads += 1;
        return index.sourceRevision;
      },
      validateIndex: () => {
        calls.validations += 1;
        if (control.rejectCollection)
          throw new TypeError("reader collection rejected");
      }
    };
  return { calls, control, definition, index, parsedMetadata, parsedStates };
}

export function rawReaderIndex(index: StateIndex<ReaderLoadState>): JsonObject {
  return JSON.parse(JSON.stringify(index)) as JsonObject;
}
