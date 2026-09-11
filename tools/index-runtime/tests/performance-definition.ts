import * as v from "valibot";
import { defineStateIndexDefinition } from "../src/index.ts";

export const scaleStateSchema = v.strictObject({
  body: v.string(),
  createdAt: v.pipe(v.number(), v.finite()),
  id: v.string(),
  status: v.picklist(["active", "archived"]),
  tags: v.array(v.string()),
  title: v.string()
});
export type ScaleState = v.InferOutput<typeof scaleStateSchema>;
export function createScaleDefinition(input: {
  sourceRevision: { entries: Record<string, string>; metadata: string };
  stateRecord: Record<string, ScaleState>;
}) {
  return defineStateIndexDefinition<ScaleState>({
    definitionVersion: 1,
    queryFields: [
      {
        mode: "exact",
        name: "status",
        sources: [{ kind: "state-path", path: ["status"] }]
      },
      {
        mode: "exact",
        name: "tag",
        sources: [{ kind: "state-path", path: ["tags"] }]
      },
      {
        mode: "range",
        name: "created-at",
        sources: [{ kind: "state-path", path: ["createdAt"] }]
      },
      {
        mode: "text",
        name: "text",
        sources: [
          { kind: "state-path", path: ["title"] },
          { kind: "state-path", path: ["body"] }
        ]
      }
    ],
    namespace: "scale",
    parseMetadata: (metadata) => metadata,
    parseState: (state) => v.parse(scaleStateSchema, state),
    read: async () => ({
      metadata: {},
      sourceRevision: input.sourceRevision,
      states: input.stateRecord
    }),
    readRevision: async () => input.sourceRevision
  });
}
