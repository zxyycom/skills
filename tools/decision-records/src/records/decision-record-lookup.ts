import { decisionNameFromId } from "../collection/decision-path.ts";
import {
  isEstablishedDecisionRecord,
  type DecisionId,
  type DecisionRecord,
  type EstablishedDecisionRecord
} from "../types.ts";

/** All matches preserve scan order; record preparation still selects the first. */
export type DecisionRecordLookup = ReadonlyMap<
  string,
  readonly DecisionRecord[]
>;
export function createDecisionRecordLookup(
  records: readonly DecisionRecord[]
): DecisionRecordLookup {
  const byId = new Map<string, DecisionRecord[]>();
  for (const record of records) {
    const id = record.decisionId;
    const matches = byId.get(id);
    if (matches === undefined) byId.set(id, [record]);
    else matches.push(record);
  }
  return byId;
}
export function findDecisionRecord(
  records: DecisionRecordLookup,
  id: DecisionId
): DecisionRecord | null {
  return records.get(id)?.[0] ?? null;
}
export function findEstablishedDecisionRecord(
  records: DecisionRecordLookup,
  id: DecisionId
): EstablishedDecisionRecord | null {
  const record = findDecisionRecord(records, id);
  return record !== null && isEstablishedDecisionRecord(record) ? record : null;
}
/** Build only for a resolution that uses names; repeated IDs remain repeated. */
export function createDecisionNameLookup(
  ids: Iterable<DecisionId>
): ReadonlyMap<string, readonly DecisionId[]> {
  const byName = new Map<string, DecisionId[]>();
  for (const id of ids) {
    const name = decisionNameFromId(id);
    const matches = byName.get(name);
    if (matches === undefined) byName.set(name, [id]);
    else matches.push(id);
  }
  for (const matches of byName.values()) matches.sort();
  return byName;
}
