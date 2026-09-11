import fs from "node:fs/promises";
import path from "node:path";
import {
  decisionFileSystemDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import type {
  CandidateDecisionRecord,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";

export async function readDecisionBody(
  decisionsDirectory: string,
  record: CandidateDecisionRecord | IndexedDecisionRecord
): Promise<DecisionApplicationFailure | { status: "ok"; value: string }> {
  try {
    const sourceFilePath = path.join(
      decisionsDirectory,
      ...record.sourcePath.split("/")
    );
    const entry = await fs.lstat(sourceFilePath);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error("must be a regular non-symbolic-link file");
    const markdown = await fs.readFile(sourceFilePath, "utf8");
    if (decisionIdFromMarkdown(markdown) !== record.decisionId)
      throw new Error(
        "frontmatter Decision ID does not match the requested ID"
      );
    return { status: "ok", value: markdown };
  } catch (error) {
    return decisionFailure([
      decisionFileSystemDiagnostic(
        {
          code: "decision-records.decision-body-unavailable",
          reason: "Failed to read decision body " + record.sourcePath + ".",
          recovery:
            "Restore a readable regular decision Markdown file, then retry the command.",
          target: record.sourcePath
        },
        error
      )
    ]);
  }
}
