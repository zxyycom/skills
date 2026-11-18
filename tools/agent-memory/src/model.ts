import * as v from "valibot";

export const memoryKind = v.picklist(
  ["knowledge", "intent"],
  "kind must be knowledge or intent"
);
export const edgeType = v.picklist(
  ["composition", "supports", "limits", "conflicts", "replaces", "splits"],
  "unknown edge type"
);
export const unitState = v.picklist([
  "active",
  "pending",
  "disabled",
  "hidden",
  "superseded",
  "completed",
  "cancelled"
]);
export const positiveInteger = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1)
);
export const closeOutcome = v.picklist(
  ["completed", "cancelled"],
  "invalid close outcome"
);
export const forgetAction = v.picklist(
  ["disable", "hide", "purge"],
  "invalid forget action"
);
export type ForgetAction = v.InferOutput<typeof forgetAction>;
export type UnitState = v.InferOutput<typeof unitState>;
