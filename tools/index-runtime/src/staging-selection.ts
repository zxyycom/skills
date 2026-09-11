import { compareIndexText } from "./ordering.ts";
import type { JsonObject, StateIndex, StateSnapshot } from "./types.ts";

export function selectTargetSnapshot<
  State extends object,
  Metadata extends JsonObject
>(
  revision: StateIndex<State, Metadata> | null,
  workspace: StateIndex<State, Metadata>,
  selectedIds: ReadonlySet<string>
): StateSnapshot<State, Metadata> {
  const states: Array<[string, State]> = [];
  const revisions: Array<[string, string]> = [];
  const allIds = new Set([
    ...Object.keys(revision?.entries ?? {}),
    ...Object.keys(workspace.entries)
  ]);
  for (const id of [...allIds].sort(compareIndexText)) {
    const source = selectedIds.has(id) ? workspace : revision;
    if (source === null || !hasEntry(source, id)) {
      continue;
    }
    states.push([id, source.entries[id]]);
    revisions.push([id, source.sourceRevision.entries[id]]);
  }
  return {
    metadata: revision?.metadata ?? workspace.metadata,
    sourceRevision: {
      entries: Object.fromEntries(revisions),
      metadata:
        revision?.sourceRevision.metadata ?? workspace.sourceRevision.metadata
    },
    states: Object.fromEntries(states)
  };
}

export function hasEntry<State extends object, Metadata extends JsonObject>(
  index: StateIndex<State, Metadata> | null,
  id: string
): index is StateIndex<State, Metadata> {
  return index !== null && Object.hasOwn(index.entries, id);
}
