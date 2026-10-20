import { buildDecisionStateSnapshotFromSources } from "../../src/decision-state-index.ts";
import type { IndexedDecisionState } from "../../src/decision-query-contract.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  candidateDecisionBody
} from "../support-record-fixture.ts";
export async function listStateSnapshot(
  extra: readonly { id: string; text: string }[] = []
) {
  const archived = candidateDecisionBody({ id: archivedDecisionId })
    .replace("status: candidate", "status: archived")
    .replace("alignment: null", "alignment: unaligned")
    .replace("createdAt: null", "createdAt: 2026-07-10T09:10:11+08:00");
  const active = candidateDecisionBody({
    id: currentDecisionId,
    tags: ["project-tooling"],
    relations: [{ type: "修订", target: archivedDecisionId }]
  })
    .replace("status: candidate", "status: active")
    .replace("alignment: null", "alignment: aligned")
    .replace("createdAt: null", "createdAt: 2026-07-11T14:15:16+08:00");
  return await buildDecisionStateSnapshotFromSources([
    {
      decisionId: currentDecisionId,
      sourcePath: `${currentDecisionId}.md`,
      text: active
    },
    {
      decisionId: archivedDecisionId,
      sourcePath: `archive/${archivedDecisionId}.md`,
      text: archived
    },
    ...extra.map(({ id, text }) => ({
      decisionId: id,
      sourcePath: `${id}.md`,
      text
    }))
  ]);
}

export async function listSnapshotEntries(
  extra: readonly { id: string; text: string }[] = []
): Promise<IndexedDecisionState[]> {
  const snapshot = await listStateSnapshot(extra);
  return Object.entries(snapshot.states).map(([id, state]) => ({ id, state }));
}
