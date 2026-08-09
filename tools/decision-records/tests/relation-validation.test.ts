import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  archivedRelativePath,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  runSuccessfulSourceCli,
  withFixtureWorkspace
} from "./support.ts";

test("candidate relations are checked prospectively without entering the established graph", () => (
  withFixtureWorkspace("candidate-relation-preview", async (workspaceRoot) => {
  const indexPath = path.join(
    workspaceRoot,
    "docs",
    "decisions",
    "decision-index.json"
  );
  const targetCandidateRelativePath =
    "decision-records/use-candidate-relation-target.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, targetCandidateRelativePath),
    candidateDecisionBody(),
    "utf8"
  );
  const candidateRelativePath =
    "decision-records/use-forward-looking-relation.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, candidateRelativePath),
    candidateDecisionBody({
      relations: [{ type: "修订", target: targetCandidateRelativePath }]
    }),
    "utf8"
  );

  const validation = await validateDecisionRecords({ workspaceRoot });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.activationCandidateCount, 2);
  const index = await readIndex(indexPath);
  assert.equal(Object.hasOwn(index.entries, candidateRelativePath), false);
  assert.equal(Object.hasOwn(index.entries, targetCandidateRelativePath), false);
  assert.equal(findIndexEntry(index, currentRelativePath).status, "active");
  })
));

test("candidate relation validation rejects missing targets", () => (
  withFixtureWorkspace("candidate-relation-missing-target", async (workspaceRoot) => {
  const invalidRelativePath = "decision-records/use-missing-relation-target.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, invalidRelativePath),
    candidateDecisionBody({
      relations: [{
        type: "修订",
        target: "decision-records/missing-target.md"
      }]
    }),
    "utf8"
  );

  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("target does not exist")
  ));
  })
));

test("candidate relation validation rejects self references", () => (
  withFixtureWorkspace("candidate-relation-self-reference", async (workspaceRoot) => {
  const invalidRelativePath = "decision-records/use-self-relation.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, invalidRelativePath),
    candidateDecisionBody({
      relations: [{ type: "修订", target: invalidRelativePath }]
    }),
    "utf8"
  );

  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("must not relate to itself")
  ));
  })
));

test("candidate relation validation rejects repeated targets", () => (
  withFixtureWorkspace("candidate-relation-repeated-target", async (workspaceRoot) => {
  const invalidRelativePath = "decision-records/use-repeated-relation-target.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, invalidRelativePath),
    candidateDecisionBody({
      relations: [
        { type: "修订", target: currentRelativePath },
        { type: "替代", target: currentRelativePath }
      ]
    }),
    "utf8"
  );

  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("repeats relationship target")
  ));
  })
));

test("strict relation checks reject undersized pure merges", () => (
  withFixtureWorkspace("relation-static-merge", async (workspaceRoot) => {
  const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const currentText = await fs.readFile(currentPath, "utf8");
  const relationMarker = "relations:\n  - type: 修订\n    target: "
    + archivedRelativePath;
  assert.ok(currentText.includes(relationMarker));
  await fs.writeFile(
    currentPath,
    currentText.replace(
      relationMarker,
      "relations:\n  - type: 归并\n    target: " + archivedRelativePath
    ),
    "utf8"
  );

  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("pure 归并 relation set must have at least two")
  ));
  })
));

test("strict relation checks reject open splits", () => (
  withFixtureWorkspace("relation-static-open-split", async (workspaceRoot) => {
  const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const currentText = await fs.readFile(currentPath, "utf8");
  const relationMarker = "relations:\n  - type: 修订\n    target: "
    + archivedRelativePath;
  assert.ok(currentText.includes(relationMarker));
  await fs.writeFile(
    currentPath,
    currentText.replace(
      relationMarker,
      "relations:\n  - type: 拆分\n    target: " + archivedRelativePath
    ),
    "utf8"
  );

  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("at least two direct 拆分 successors")
  ));
  })
));

test("strict relation checks reject impure split successors", () => (
  withFixtureWorkspace("relation-static-impure-split", async (workspaceRoot) => {
  const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const currentText = await fs.readFile(currentPath, "utf8");
  const secondArchivedRelativePath =
    "decision-records/use-second-archived-predecessor.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, secondArchivedRelativePath),
    candidateDecisionBody(),
    "utf8"
  );
  await runSuccessfulSourceCli([
    "activate",
    secondArchivedRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  await runSuccessfulSourceCli([
    "archive",
    secondArchivedRelativePath,
    "--root",
    workspaceRoot
  ]);
  const relationMarker = "relations:\n  - type: 修订\n    target: "
    + archivedRelativePath;
  assert.ok(currentText.includes(relationMarker));
  await fs.writeFile(
    currentPath,
    currentText.replace(
      relationMarker,
      "relations:\n"
        + "  - type: 拆分\n"
        + "    target: " + archivedRelativePath + "\n"
        + "  - type: 修订\n"
        + "    target: " + secondArchivedRelativePath
    ),
    "utf8"
  );

  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes(
      "拆分 successor must have exactly one direct 拆分 relation"
    )
  ));
  })
));
