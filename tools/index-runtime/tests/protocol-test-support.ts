import {
  defineStateIndexDefinition,
  type JsonObject,
  type StateSourceRevision
} from "../src/index.ts";

export function baseDefinition(namespace: string) {
  return {
    definitionVersion: 1,
    queryFields: [
      {
        mode: "exact" as const,
        name: "status",
        sources: [{ kind: "state-path" as const, path: ["status"] }]
      }
    ],
    namespace,
    parseMetadata: (metadata: JsonObject) => metadata,
    parseState: (state: JsonObject) => state,
    read: async () => snapshot("state", {}),
    readRevision: async () => revision("state")
  };
}

export function malformedReadDefinition() {
  return defineStateIndexDefinition<JsonObject>({
    ...baseDefinition("malformed-read"),
    read: async () => null as never
  });
}

export function snapshot(id: string, state: JsonObject) {
  return {
    metadata: {},
    sourceRevision: revision(id),
    states: Object.fromEntries([[id, state]])
  };
}

export function revision(id: string): StateSourceRevision {
  return {
    entries: Object.fromEntries([[id, `source:${id}`]]),
    metadata: "source:metadata"
  };
}
