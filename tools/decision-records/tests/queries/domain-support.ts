export { listStateSnapshot, listSnapshotEntries } from "./snapshot-fixture.ts";
import os from "node:os";
import { isDecisionTag } from "../../src/collection/decision-path.ts";
import assert from "node:assert/strict";

import {
  prepareDecisionListRequest,
  projectDecisionList
} from "../../src/query/decision-query-list.ts";
import { printDecisionListSuccess } from "../../src/cli/output/cli-output-list.ts";
import type {
  DecisionQueryRequest,
  IndexedDecisionState
} from "../../src/query/decision-query-contract.ts";

type ListRequest = Extract<DecisionQueryRequest, { command: "list" }>;
type ListOptions = Partial<Omit<ListRequest, "tags">> & {
  tags?: readonly string[];
};

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
