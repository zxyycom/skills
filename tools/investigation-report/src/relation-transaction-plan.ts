import path from "node:path";
import {
  writeRecordFileAtomically,
  type RecordFileWrite
} from "../../record-operations/src/transaction-files.ts";
import { type RecordTransactionPlan } from "../../record-operations/src/transaction.ts";
import {
  investigationFileWrite,
  investigationMembers,
  type InvestigationMember
} from "./transaction-files.ts";
import { type CandidateRelationContext } from "./relation-transaction-candidate.ts";
import { type RelationTransactionOptions } from "./relation-transaction-preparation.ts";

import { writeTextAtomically } from "./relation-transaction-support.ts";

export type PreparedRelationTransaction = Readonly<{
  context: CandidateRelationContext;
  members: readonly InvestigationMember[];
}>;
export async function prepareRelationWrites(
  options: RelationTransactionOptions,
  context: CandidateRelationContext
): Promise<RecordTransactionPlan<PreparedRelationTransaction>> {
  const guards = [];
  for (const source of context.collection.sources) {
    const file = await investigationFileWrite(
      options.root,
      path.join(options.root, source.sourcePath),
      source.text,
      source.text
    );
    guards.push({ path: file.path, before: file.before });
  }
  const originals = new Map(
    context.collection.sources.map((source) => [source.id, source])
  );
  const writes = [];
  const changedSources = new Set(context.changedSources);
  for (const source of context.candidateSources) {
    if (!changedSources.has(source.id)) continue;
    writes.push(
      ownedDefaultRelationWrite(
        options,
        await investigationFileWrite(
          options.root,
          path.join(options.root, source.sourcePath),
          originals.get(source.id)!.text,
          source.text,
          { writer: options.write }
        )
      )
    );
  }
  const index = ownedDefaultRelationWrite(
    options,
    await investigationFileWrite(
      options.root,
      options.indexPath,
      context.originalIndexText,
      context.nextIndexText,
      { writer: options.write, mode: 0o600 }
    )
  );
  return {
    value: { context, members: await investigationMembers(options.root) },
    root: options.root,
    guards,
    writes,
    index
  } satisfies RecordTransactionPlan<PreparedRelationTransaction>;
}
function ownedDefaultRelationWrite(
  options: RelationTransactionOptions,
  change: RecordFileWrite
): RecordFileWrite {
  return options.write === writeTextAtomically
    ? {
        ...change,
        write: async (_target, bytes) =>
          await writeRecordFileAtomically(options.root, {
            ...change,
            next: bytes
          })
      }
    : change;
}
