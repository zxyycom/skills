import os from "node:os";
import { isDecisionTag } from "../../src/decision-path.ts";
import assert from "node:assert/strict";
import { buildDecisionStateSnapshotFromSources } from "../../src/decision-state-index.ts";
import {
  prepareDecisionListRequest,
  projectDecisionList
} from "../../src/decision-query-list.ts";
import { printDecisionListSuccess } from "../../src/cli-output-list.ts";
import type {
  DecisionQueryRequest,
  IndexedDecisionState
} from "../../src/decision-query-contract.ts";
import {
  archivedDecisionId,
  candidateDecisionBody,
  currentDecisionId
} from "../support.ts";

type ListRequest = Extract<DecisionQueryRequest, { command: "list" }>;
type ListOptions = Partial<Omit<ListRequest, "tags">> & {
  tags?: readonly string[];
};

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

export function listProjection(
  entries: readonly IndexedDecisionState[],
  options: ListOptions = {}
) {
  const request: ListRequest = {
    command: "list",
    alignment: "all",
    status: "active",
    limit: 10,
    offset: 0,
    location: { decisionsDir: "docs/decisions", workspaceRoot: os.tmpdir() },
    ...options,
    tags: (options.tags ?? []).map((tag) => {
      assert.ok(isDecisionTag(tag), `Expected valid Decision tag ${tag}`);
      return tag;
    })
  };
  const prepared = prepareDecisionListRequest(request);
  assert.equal(prepared.status, "ok");
  if (prepared.status !== "ok") throw new Error("Expected valid list options");
  const result = projectDecisionList(entries, request, prepared);
  assert.equal(result.status, "ok");
  if (result.status !== "ok" || result.command !== "list")
    throw new Error("Expected list projection");
  return result;
}

export function renderedList(
  entries: readonly IndexedDecisionState[],
  options: ListOptions = {},
  fullTime = false
): string {
  const result = listProjection(entries, options);
  let stdout = "";
  printDecisionListSuccess(
    result,
    { detail: false, fullTime },
    {
      stdout: (value) => {
        stdout += value;
      },
      stderr: () => {
        throw new Error("Unexpected list diagnostic");
      }
    }
  );
  return stdout;
}
