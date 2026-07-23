import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  syncDecisionIndex
} from "../src/decision-state-index.ts";
import { selectDecisionIndexSourcePaths } from "../src/index.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  currentRelativePath,
  findIndexEntry,
  fixtureRoot,
  readIndex
} from "./support.ts";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-state-snapshot-")
);
try {
  await fs.cp(fixtureRoot, tempRoot, { recursive: true });
  const scan = await scanDecisionRecords({ workspaceRoot: tempRoot });
  const selection = selectDecisionIndexSourcePaths(scan);
  assert.deepEqual(selection.errors, []);

  const decisionsDirectory = path.join(tempRoot, "docs", "decisions");
  const decisionPath = path.join(decisionsDirectory, currentRelativePath);
  const original = await fs.readFile(decisionPath, "utf8");
  const nextTitle = "使用当前快照读取器";
  await fs.writeFile(
    decisionPath,
    original.replace("# 使用生成 CLI", `# ${nextTitle}`),
    "utf8"
  );

  const synchronized = await syncDecisionIndex({
    decisionsDirectory,
    mode: "write",
    relativePaths: selection.relativePaths
  });
  assert.equal(synchronized.status, "ok");

  const index = await readIndex(path.join(
    decisionsDirectory,
    "decision-index.json"
  ));
  assert.equal(
    findIndexEntry(index, currentRelativePath).title,
    nextTitle
  );
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}
