import assert from "node:assert/strict";
import path from "node:path";
import { stageDecisionRecords } from "../src/decision-stage-service.ts";
import {
  parseDecisionIndex,
  syncDecisionIndex
} from "../src/decision-state-index.ts";
import { decisionIdForTest } from "./support-record-fixture.ts";
import {
  candidateDecisionBody,
  commitWorkspace,
  initializeGitRepository,
  runGit,
  writeDecision
} from "./support.ts";

export const a = decisionIdForTest("260901-local-a");
export const b = decisionIdForTest("260901-local-b");
export async function sync(root: string) {
  const result = await syncDecisionIndex({
    decisionsDirectory: path.join(root, "docs/decisions"),
    mode: "write"
  });
  assert.equal(result.status, "ok", JSON.stringify(result));
}
export async function formal(root: string, id: string, title: string) {
  await writeDecision(
    root,
    id,
    candidateDecisionBody({ id, title })
      .replace("status: candidate", "status: active")
      .replace("alignment: null", "alignment: unaligned")
      .replace("createdAt: null", "createdAt: 2026-09-01T00:00:00Z")
  );
}
export async function fixture(root: string, git = false) {
  if (git) initializeGitRepository(root);
  await formal(root, a, "原始 A");
  await formal(root, b, "原始 B");
  await sync(root);
  if (git) commitWorkspace(root);
}
export function stage(
  root: string,
  ids: string[],
  scope: "index" | "domain" | "all" = "all"
) {
  return stageDecisionRecords({
    decisionIds: ids,
    scope,
    location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
  });
}
export function pending(root: string, file: string) {
  return runGit(root, ["show", ":docs/decisions/" + file]);
}

export function parseIndex(text: string) {
  const parsed = parseDecisionIndex(text, "test decision-index.json");
  assert.equal(parsed.status, "ok", JSON.stringify(parsed));
  if (parsed.status !== "ok") assert.fail("Expected a valid decision index");
  return parsed.value;
}
