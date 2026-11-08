// The shared JSON contract is authoritative; this compatibility export remains
// available while the TypeScript implementation is the production entry.
import schema from "../../../record-contracts/schemas/decision-index.schema.json" with { type: "json" };

export const decisionIndexJsonSchema = schema;
