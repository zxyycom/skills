/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-transaction-plan.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-transaction-plan.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-transaction-plan.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { normalizeRecordTransactionPlan } from "../../record-operations/src/transaction-plan.ts";
import type { DecisionSourceCapture } from "./decision-strict-preparation.ts";
import path from "node:path";
import { decisionTransactionMembers } from "./decision-source-membership.ts";
import {
  readRecordFileSnapshot,
  writeRecordFileAtomically,
  type RecordFileSnapshot,
  type RecordFileWrite
} from "../../record-operations/src/transaction-files.ts";
import type { RecordTransactionPlan } from "../../record-operations/src/transaction.ts";
import { decisionSourceIdentityFromMarkdown } from "./decision-metadata.ts";
import { serializeDecisionIndex } from "./decision-state-index.ts";
import { projectDecisionTransactionIndex } from "./decision-transaction-projection.ts";
import {
  captureDecisionTransactionSources,
  decisionTransactionMemberPath,
  requireExpectedDecisionText,
  type DecisionTransactionSources
} from "./decision-transaction-source.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type { DecisionIndex, DecisionPreparationContext } from "./types.ts";

export type PreparedDecisionTransaction = Readonly<{
  context: DecisionPreparationContext;
  beforeMembers: readonly string[];
  afterMembers: readonly string[];
}>;

type DecisionWriteSet = Readonly<{
  originals: Map<string, RecordFileSnapshot | null>;
  writes: RecordFileWrite[];
  sources: Set<string>;
  targets: Set<string>;
  afterMembers: Set<string>;
}>;

/** 来源保护、领域写集与最终索引投影依次准备，再交共同事务执行。 */
export async function prepareDecisionTransactionPlan(
  context: DecisionPreparationContext,
  changes: readonly DecisionFileChange[],
  sourceCapture?: DecisionSourceCapture
): Promise<RecordTransactionPlan<PreparedDecisionTransaction>> {
  const acquired = await captureDecisionTransactionSources(
    context,
    sourceCapture
  );
  const candidateOnly = isCandidateOnlyChange(changes);
  const writeSet = await prepareDecisionWrites(
    context,
    changes,
    acquired,
    candidateOnly
  );
  const next = await projectDecisionTransactionIndex(
    context,
    changes,
    sourceCapture !== undefined
  );
  const index = decisionIndexWrite(
    context,
    acquired.indexBefore,
    next,
    candidateOnly
  );
  const writePaths = new Set(writeSet.writes.map((write) => write.path));
  if (index !== null) writePaths.add(index.path);
  const guards = [...acquired.originals]
    .filter(([filePath]) => !writePaths.has(filePath))
    .map(([filePath, before]) => ({ path: filePath, before }));
  return normalizeRecordTransactionPlan({
    value: {
      context,
      beforeMembers: acquired.beforeMembers,
      afterMembers: [...writeSet.afterMembers].sort()
    },
    root: context.workspaceRoot,
    writes: writeSet.writes,
    index,
    guards
  });
}

async function prepareDecisionWrites(
  context: DecisionPreparationContext,
  changes: readonly DecisionFileChange[],
  acquired: DecisionTransactionSources,
  candidateOnly: boolean
): Promise<DecisionWriteSet> {
  const writeSet: DecisionWriteSet = {
    originals: acquired.originals,
    writes: [],
    sources: new Set<string>(),
    targets: new Set<string>(),
    afterMembers: new Set(acquired.beforeMembers)
  };
  for (const change of orderedDecisionChanges(changes, candidateOnly))
    await appendDecisionChange(context, change, writeSet);
  return writeSet;
}

/** 候选身份移动在引用更新后退出旧位置，使最后动作保持原来的候选提交点。 */
function orderedDecisionChanges(
  changes: readonly DecisionFileChange[],
  candidateOnly: boolean
): readonly DecisionFileChange[] {
  if (!candidateOnly) return changes;
  const inPlace: DecisionFileChange[] = [];
  const moved: DecisionFileChange[] = [];
  for (const change of changes) {
    if (
      change.targetPath === undefined ||
      change.targetPath === change.decisionPath
    )
      inPlace.push(change);
    else moved.push(change);
  }
  return [...inPlace, ...moved];
}

async function appendDecisionChange(
  context: DecisionPreparationContext,
  change: DecisionFileChange,
  writeSet: DecisionWriteSet
): Promise<void> {
  if (writeSet.sources.has(change.decisionPath)) {
    throw new Error(
      "Decision transaction contains the same source more than once: " +
        change.decisionPath
    );
  }
  writeSet.sources.add(change.decisionPath);
  const before = writeSet.originals.get(change.decisionPath);
  if (before === undefined || before === null) {
    throw new Error(
      "Decision transaction source is not prepared: " + change.decisionPath
    );
  }
  requireExpectedDecisionText(before, change.expectedText, change.decisionPath);
  const target = change.targetPath ?? change.decisionPath;
  if (writeSet.targets.has(target)) {
    throw new Error(
      "Decision transaction contains the same target more than once: " + target
    );
  }
  writeSet.targets.add(target);
  if (target !== change.decisionPath) {
    writeSet.writes.push(
      ...(await decisionMoveWrites(context, change, before, target))
    );
    writeSet.originals.set(target, null);
  } else
    writeSet.writes.push({
      path: change.decisionPath,
      before,
      next: change.nextText === null ? null : Buffer.from(change.nextText)
    });
  writeSet.afterMembers.delete(
    decisionTransactionMemberPath(context, change.decisionPath)
  );
  if (change.nextText !== null)
    writeSet.afterMembers.add(decisionTransactionMemberPath(context, target));
}

/** 新位置独占建立并继承 mode，随后退出旧位置；不把预演成员当实际写入。 */
async function decisionMoveWrites(
  context: DecisionPreparationContext,
  change: DecisionFileChange,
  before: RecordFileSnapshot,
  target: string
): Promise<readonly RecordFileWrite[]> {
  if (change.nextText === null)
    throw new Error("A Decision move requires replacement text.");
  if ((await readRecordFileSnapshot(context.workspaceRoot, target)) !== null)
    throw new Error("Decision move target already exists: " + target);
  return [
    {
      path: target,
      before: null,
      next: Buffer.from(change.nextText),
      mode: before.mode
    },
    { path: change.decisionPath, before, next: null }
  ];
}

function decisionIndexWrite(
  context: DecisionPreparationContext,
  before: RecordFileSnapshot | null,
  next: DecisionIndex,
  candidateOnly: boolean
): RecordFileWrite | null {
  // 候选保持既有索引表示；最后正式成员退出仍发布合法空索引。
  if (
    candidateOnly ||
    (Object.keys(next.entries).length === 0 && !context.indexExists)
  )
    return null;
  return {
    path: context.indexPath,
    before,
    next: Buffer.from(serializeDecisionIndex(next)),
    ...(before === null ? { creationMode: 0o666 } : {}),
    write: async (target, bytes) =>
      await writeRecordFileAtomically(
        context.workspaceRoot,
        {
          path: target,
          before,
          next: bytes,
          ...(before === null ? { creationMode: 0o666 } : {})
        },
        path.dirname(context.decisionsDirectory)
      )
  };
}

export async function verifyDecisionTransactionMembers(
  value: PreparedDecisionTransaction,
  phase: "before" | "after"
): Promise<void> {
  const actual = await decisionTransactionMembers(
    value.context.decisionsDirectory
  );
  const expected =
    phase === "before" ? value.beforeMembers : value.afterMembers;
  if (
    actual.length !== expected.length ||
    actual.some((member, index) => member !== expected[index])
  )
    throw new Error(
      "Decision collection membership changed during transaction."
    );
}

function isCandidateOnlyChange(
  changes: readonly DecisionFileChange[]
): boolean {
  return (
    changes.length > 0 &&
    changes.every(
      (change) =>
        isCandidateText(change.expectedText) &&
        (change.nextText === null || isCandidateText(change.nextText))
    )
  );
}

function isCandidateText(text: string): boolean {
  const identity = decisionSourceIdentityFromMarkdown(text);
  return identity.decisionId !== null && identity.isCandidate;
}
