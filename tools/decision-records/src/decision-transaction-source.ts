import type { DecisionSourceCapture } from "./decision-strict-preparation.ts";
import { requireRecordTextSnapshot } from "../../record-operations/src/transaction-snapshot.ts";
import path from "node:path";
import { decisionTransactionMembers } from "./decision-source-membership.ts";
import {
  readRecordFileSnapshot,
  type RecordFileSnapshot
} from "../../record-operations/src/transaction-files.ts";
import type { DecisionPreparationContext, DecisionRecord } from "./types.ts";

export type DecisionTransactionSources = Readonly<{
  originals: Map<string, RecordFileSnapshot | null>;
  indexBefore: RecordFileSnapshot | null;
  beforeMembers: readonly string[];
}>;

/** 把已验领域正文绑定本阶段实际文件快照与成员清单，不创建目录或写入。 */
export async function captureDecisionTransactionSources(
  context: DecisionPreparationContext,
  sourceCapture?: DecisionSourceCapture
): Promise<DecisionTransactionSources> {
  const originals = new Map<string, RecordFileSnapshot | null>();
  for (const record of context.records) {
    const snapshot = await captureDecisionSource(
      context.workspaceRoot,
      record,
      sourceCapture
    );
    originals.set(record.decisionPath, snapshot);
  }
  const capturedIndex = sourceCapture?.sources.get(context.indexPath);
  const indexBefore =
    capturedIndex === undefined
      ? await readRecordFileSnapshot(context.workspaceRoot, context.indexPath)
      : requireRecordTextSnapshot(
          capturedIndex,
          context.workspaceRoot,
          context.indexPath,
          context.indexText
        );
  if (context.indexExists)
    requireExpectedDecisionText(
      indexBefore,
      context.indexText,
      context.indexPath
    );
  else if (indexBefore !== null)
    throw new Error(
      "Decision index appeared after preparation: " + context.indexPath
    );
  originals.set(context.indexPath, indexBefore);
  const beforeMembers =
    context.publishedBaseline === undefined
      ? await decisionTransactionMembers(context.decisionsDirectory)
      : context.records.map((record) => record.sourcePath).sort();
  verifyPreparedDecisionMembers(context, beforeMembers);
  return { originals, indexBefore, beforeMembers };
}

async function captureDecisionSource(
  root: string,
  record: DecisionRecord,
  sourceCapture?: DecisionSourceCapture
): Promise<RecordFileSnapshot | null> {
  if (record.source.kind === "missing")
    throw new Error(
      "Prepared Decision source is missing: " + record.sourcePath
    );
  const captured = sourceCapture?.sources.get(record.decisionPath);
  if (sourceCapture !== undefined && captured === undefined)
    throw new Error(
      "Current preparation has no source proof: " + record.decisionPath
    );
  const snapshot =
    captured === undefined
      ? await readRecordFileSnapshot(root, record.decisionPath)
      : requireRecordTextSnapshot(
          captured,
          root,
          record.decisionPath,
          record.source.text
        );
  requireExpectedDecisionText(
    snapshot,
    record.source.text,
    record.decisionPath
  );
  return snapshot;
}

function verifyPreparedDecisionMembers(
  context: DecisionPreparationContext,
  beforeMembers: readonly string[]
): void {
  if (context.publishedBaseline !== undefined) return;
  const preparedMembers =
    context.sourceMembers ??
    context.records.map((record) => record.sourcePath).sort();
  const comparedMembers =
    context.sourceMembers === undefined
      ? beforeMembers.filter((member) => member.endsWith(".md"))
      : beforeMembers;
  if (
    preparedMembers.length !== comparedMembers.length ||
    preparedMembers.some((member, index) => member !== comparedMembers[index])
  )
    throw new Error(
      "Decision collection membership changed after preparation."
    );
}

export function decisionTransactionMemberPath(
  context: DecisionPreparationContext,
  filePath: string
): string {
  return path
    .relative(context.decisionsDirectory, filePath)
    .split(path.sep)
    .join("/");
}

export function requireExpectedDecisionText(
  snapshot: RecordFileSnapshot | null,
  expected: string,
  filePath: string
): void {
  if (
    snapshot === null ||
    !Buffer.from(snapshot.bytes).equals(Buffer.from(expected))
  )
    throw new Error(
      "Decision source or index changed after validation: " +
        filePath +
        ". No files were written."
    );
}
