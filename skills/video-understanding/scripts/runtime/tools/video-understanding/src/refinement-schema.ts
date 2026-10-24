/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/refinement-schema.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/refinement-schema.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/refinement-schema.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import * as v from "valibot";
import {
  FrameIdSchema,
  MaterialIdSchema,
  RawIdSchema,
  RefinementIdSchema,
  RevisionSchema,
  ScopeSchema,
  SegmentSchema,
  TranscriptIdSchema,
  type Evidence,
  type Material,
  type Observation,
  type Transcript
} from "./evidence.ts";

const uniqueRefs = <T extends v.GenericSchema>(schema: T) =>
  v.pipe(
    v.array(schema),
    v.check((ids) => new Set(ids).size === ids.length, "unique references")
  );
const NonemptyText = v.pipe(
  v.string(),
  v.check((text) => text.trim().length > 0)
);
const Support = uniqueRefs(RawIdSchema);
const Verification = v.strictObject({ refs: Support, note: NonemptyText });
const Shared = {
  support: v.optional(Support, []),
  reason: NonemptyText,
  verified: Verification
};
const CorrectionFields = {
  ...Shared,
  kind: v.literal("correction"),
  targets: v.pipe(uniqueRefs(TranscriptIdSchema), v.minLength(1)),
  replacement: v.strictObject({
    segments: v.array(
      v.pipe(
        SegmentSchema,
        v.check((segment) => segment.text.trim().length > 0)
      )
    )
  })
};
const DescriptionFields = {
  ...Shared,
  support: v.optional(
    uniqueRefs(v.pipe(v.string(), v.regex(/^[TO]\d{4,}$/))),
    []
  ),
  kind: v.literal("description"),
  refs: v.pipe(uniqueRefs(FrameIdSchema), v.length(1)),
  text: NonemptyText
};
const SourceSelectionFields = {
  ...Shared,
  kind: v.literal("selection"),
  mode: v.literal("source"),
  material: MaterialIdSchema,
  purpose: v.picklist(["transcript", "subtitle", "translation"])
};
const AuthoredSelectionFields = {
  ...Shared,
  kind: v.literal("selection"),
  mode: v.literal("authored"),
  refs: v.pipe(uniqueRefs(RawIdSchema), v.minLength(1)),
  purpose: v.picklist(["translation", "narrative"]),
  text: NonemptyText
};
const CreateFields = { scopeId: ScopeSchema, action: v.literal("create") };
const UpdateFields = {
  scopeId: ScopeSchema,
  action: v.literal("update"),
  id: RefinementIdSchema,
  expectedRevision: RevisionSchema
};
export const DraftSchema = v.union([
  v.strictObject({ ...CreateFields, ...CorrectionFields }),
  v.strictObject({ ...CreateFields, ...DescriptionFields }),
  v.strictObject({ ...CreateFields, ...SourceSelectionFields }),
  v.strictObject({ ...CreateFields, ...AuthoredSelectionFields }),
  v.strictObject({ ...UpdateFields, ...CorrectionFields }),
  v.strictObject({ ...UpdateFields, ...DescriptionFields }),
  v.strictObject({ ...UpdateFields, ...SourceSelectionFields }),
  v.strictObject({ ...UpdateFields, ...AuthoredSelectionFields }),
  v.strictObject({
    scopeId: ScopeSchema,
    action: v.literal("revoke"),
    id: RefinementIdSchema,
    expectedRevision: RevisionSchema
  })
]);
export type Draft = v.InferOutput<typeof DraftSchema>;
const RecordFields = {
  scopeId: ScopeSchema,
  id: RefinementIdSchema,
  revision: RevisionSchema,
  state: v.picklist(["active", "revoked"])
};
export const RefinementSchema = v.union([
  v.strictObject({ ...RecordFields, ...CorrectionFields }),
  v.strictObject({ ...RecordFields, ...DescriptionFields }),
  v.strictObject({ ...RecordFields, ...SourceSelectionFields }),
  v.strictObject({ ...RecordFields, ...AuthoredSelectionFields })
]);
export type Refinement = v.InferOutput<typeof RefinementSchema>;
export type Pointer = Evidence["refinements"][number];
export type IndexedRefinement =
  | { pointer: Pointer; status: "valid"; record: Refinement }
  | {
      pointer: Pointer;
      status: "invalid";
      reason: string;
      record?: Refinement;
    };
export type IndexedMaterial =
  | {
      material: Material;
      status: "valid";
      transcripts: Transcript[];
      observations: Observation[];
    }
  | {
      material: Material;
      status: "invalid";
      reason: string;
      transcripts: [];
      observations: [];
    };
export interface Snapshot {
  index: Evidence;
  transcripts: Transcript[];
  observations: Observation[];
  materials: IndexedMaterial[];
  unavailable: Map<string, string>;
  records: IndexedRefinement[];
  history: IndexedRefinement[];
}
