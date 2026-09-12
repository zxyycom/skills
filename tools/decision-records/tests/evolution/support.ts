import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../../src/index.ts";
import {
  archivedRelativePath,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  traceDecision,
  withFixtureWorkspace
} from "../support.ts";

export {
  archivedRelativePath,
  assert,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  test,
  traceDecision,
  validateDecisionRecords,
  withFixtureWorkspace
};

export async function establishClosedReallocation(
  workspaceRoot: string
): Promise<ClosedReallocation> {
  const secondPredecessorRelativePath =
    await establishAdditionalActivePredecessor(workspaceRoot);
  const firstSuccessorRelativePath = "use-combined-reallocation-owner";
  const secondSuccessorRelativePath = "use-narrow-reallocation-owner";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, firstSuccessorRelativePath),
    candidateDecisionBody({
      relations: [
        { type: "重划", target: currentRelativePath },
        { type: "重划", target: secondPredecessorRelativePath }
      ]
    }),
    "utf8"
  );
  await fs.writeFile(
    decisionFilePath(workspaceRoot, secondSuccessorRelativePath),
    candidateDecisionBody({
      relations: [{ type: "重划", target: currentRelativePath }]
    }),
    "utf8"
  );
  await runSuccessfulSourceLifecycleCli([
    "evolve",
    "--successor",
    "aligned=" + firstSuccessorRelativePath,
    "--successor",
    "unaligned=" + secondSuccessorRelativePath,
    "--root",
    workspaceRoot
  ]);
  return {
    firstSuccessorRelativePath,
    indexPath: path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    ),
    secondPredecessorRelativePath,
    secondSuccessorRelativePath
  };
}

export async function establishAdditionalActivePredecessor(
  workspaceRoot: string
): Promise<string> {
  const decisionId = "use-second-reallocation-predecessor";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, decisionId),
    candidateDecisionBody(),
    "utf8"
  );
  await runSuccessfulSourceLifecycleCli([
    "activate",
    decisionId,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  return decisionId;
}

export async function establishClosedSplit(
  workspaceRoot: string
): Promise<ClosedSplit> {
  const coarseRelativePath = "use-coarse-future-direction";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, coarseRelativePath),
    candidateDecisionBody(),
    "utf8"
  );
  await runSuccessfulSourceLifecycleCli([
    "activate",
    coarseRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    workspaceRoot
  ]);
  const alignedRelativePath = "keep-current-split-slice";
  const unalignedRelativePath = "keep-future-split-slice";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, alignedRelativePath),
    candidateDecisionBody({
      relations: [{ type: "修订", target: currentRelativePath }]
    }),
    "utf8"
  );
  await fs.writeFile(
    decisionFilePath(workspaceRoot, unalignedRelativePath),
    candidateDecisionBody({
      relations: [{ type: "修订", target: archivedRelativePath }]
    }),
    "utf8"
  );
  const output = await runSuccessfulSourceLifecycleCli([
    "evolve",
    "--successor",
    "aligned=" + alignedRelativePath,
    "--successor",
    "unaligned=" + unalignedRelativePath,
    "--relation",
    "拆分=" + coarseRelativePath,
    "--root",
    workspaceRoot
  ]);
  return {
    alignedRelativePath,
    coarseRelativePath,
    indexPath: path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    ),
    output,
    unalignedRelativePath
  };
}

export type ClosedSplit = {
  alignedRelativePath: string;
  coarseRelativePath: string;
  indexPath: string;
  output: string;
  unalignedRelativePath: string;
};

export type ClosedReallocation = {
  firstSuccessorRelativePath: string;
  indexPath: string;
  secondPredecessorRelativePath: string;
  secondSuccessorRelativePath: string;
};
