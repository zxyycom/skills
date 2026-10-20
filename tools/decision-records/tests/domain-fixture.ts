import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { scanSourceFiles } from "../src/scan-records.ts";
import { validateScannedRelationships } from "../src/scan-relations.ts";
import {
  decisionIdForTest,
  candidateDecisionBody
} from "./support-record-fixture.ts";
import type { DecisionScan } from "../src/types.ts";

export type DecisionSourceFixture = Readonly<{
  id: string;
  text?: string;
  status?: "candidate" | "active" | "archived";
  relations?: readonly { summary?: string; target: string; type: string }[];
}>;

function decisionSourceFixture(source: DecisionSourceFixture) {
  const status = source.status ?? "candidate";
  const text =
    source.text ??
    candidateDecisionBody({
      id: source.id,
      relations: source.relations
    })
      .replace("status: candidate", `status: ${status}`)
      .replace(
        "alignment: null",
        status === "candidate" ? "alignment: null" : "alignment: aligned"
      )
      .replace(
        "createdAt: null",
        status === "candidate"
          ? "createdAt: null"
          : "createdAt: 2026-10-01T00:00:00Z"
      );
  return {
    id: source.id,
    sourcePath: `${status === "archived" ? "archive/" : ""}${source.id}.md`,
    text
  };
}

/** 用真实来源扫描器解析 Markdown，不执行文件 I/O。 */
export async function decisionScanFromSources(
  sources: readonly DecisionSourceFixture[]
): Promise<DecisionScan> {
  const workspaceRoot = path.join(
    os.tmpdir(),
    `decision-domain-${randomUUID()}`
  );
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const sourceErrors: string[] = [];
  const indexErrors: string[] = [];
  const prepared = sources.map(decisionSourceFixture);
  const records = await scanSourceFiles({
    availableDecisionIds: new Set(
      sources.map(({ id }) => decisionIdForTest(id))
    ),
    index: null,
    indexErrors,
    indexRelativePath: "docs/decisions/decision-index.json",
    sourceErrors,
    sourceFiles: prepared.map(({ sourcePath, text }) => ({
      decisionPath: path.join(decisionsDirectory, sourcePath),
      sourcePath,
      sourceText: text
    }))
  });
  validateScannedRelationships(records, sourceErrors);
  return {
    collectionErrors: [],
    decisionsDirectoryAvailable: true,
    decisionsDirectory,
    errors: [...sourceErrors, ...indexErrors],
    indexErrors,
    index: null,
    indexExists: false,
    indexPath: path.join(decisionsDirectory, "decision-index.json"),
    indexRelativePath: "docs/decisions/decision-index.json",
    indexText: "",
    records,
    sourceErrors,
    workspaceRoot
  };
}
