import type { StateIndexDefinition, StateSnapshot } from "../src/types.ts";

type PreparedTestState = { formedAt: string; label: string };
type PreparedTestMetadata = { tenant: string };

export function preparationFixture() {
  const calls = {
    metadata: 0,
    parses: 0,
    reads: 0,
    revisions: 0,
    validates: 0
  };
  const snapshot: StateSnapshot<PreparedTestState, PreparedTestMetadata> = {
    metadata: { tenant: "one" },
    sourceRevision: { entries: { a: "a-1", b: "b-1" }, metadata: "metadata-1" },
    states: {
      a: { formedAt: "2026-01-01T00:00:00Z", label: "First" },
      b: { formedAt: "2026-01-02T00:00:00Z", label: "Second" }
    }
  };
  const definition: StateIndexDefinition<
    PreparedTestState,
    PreparedTestMetadata
  > = {
    definitionVersion: 1,
    namespace: "prepared-test",
    queryFields: [
      {
        name: "formed-at",
        mode: "range",
        sources: [
          { kind: "state-path", path: ["formedAt"], normalization: "instant" }
        ]
      }
    ],
    parseMetadata: (input) => {
      calls.metadata += 1;
      if (typeof input.tenant !== "string") throw new Error("missing tenant");
      return { tenant: input.tenant };
    },
    parseState: (input) => {
      calls.parses += 1;
      if (typeof input.formedAt !== "string" || typeof input.label !== "string")
        throw new Error("invalid state");
      return { formedAt: input.formedAt, label: input.label };
    },
    read: async () => {
      calls.reads += 1;
      return snapshot;
    },
    readRevision: async () => {
      calls.revisions += 1;
      return snapshot.sourceRevision;
    },
    validateIndex: () => {
      calls.validates += 1;
    }
  };
  return { calls, definition, snapshot };
}

export function changeState(
  snapshot: StateSnapshot<PreparedTestState, PreparedTestMetadata>,
  id: "a" | "b"
) {
  snapshot.states = {
    ...snapshot.states,
    [id]: { ...snapshot.states[id]!, label: "Changed" }
  };
  snapshot.sourceRevision = {
    ...snapshot.sourceRevision,
    entries: { ...snapshot.sourceRevision.entries, [id]: `${id}-2` }
  };
}
