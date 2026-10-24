/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-rename-noop.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-rename-noop.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-rename-noop.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import { canonicalRecordCollection } from "../../record-operations/src/source.ts";
import {
  runRecordTransaction,
  type RecordTransactionPlan
} from "../../record-operations/src/transaction.ts";
import {
  readRecordFileSnapshot,
  type RecordFileSnapshot
} from "../../record-operations/src/transaction-files.ts";
import {
  loadCandidateIdentityContext,
  type CandidateIdentityContext
} from "./decision-candidate-discovery.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import {
  decisionNameFromId,
  isDecisionId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId,
  sourcePathForDecisionRename
} from "./decision-path.ts";
import { parseDecisionIndex } from "./decision-state-index.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { decisionFailure } from "./application-result.ts";
import { transactionFileSystemDiagnostic } from "./decision-transaction.ts";
import type {
  DecisionRenameOptions,
  DecisionRenamePlan,
  DecisionRenameResult
} from "./decision-rename.ts";

import type { DecisionId } from "./types.ts";

type NoopLocation = Awaited<ReturnType<typeof canonicalRecordCollection>>;
type NoopSource = Readonly<{
  decisionId: DecisionId;
  sourcePath: string;
  name: string;
}>;

/** No-op needs identity/location safety, not unrelated bodies, graph or Git history. */
export async function tryNoopDecisionRename(
  options: DecisionRenameOptions
): Promise<DecisionRenameResult | null> {
  if (!matchingRenameSelectors(options)) {
    return null;
  }
  const canonical = await canonicalRecordCollection(
    options.workspaceRoot ?? process.cwd(),
    options.decisionsDir ?? "docs/decisions"
  );
  const selector = normalizeDecisionSelectorInput(options.source);
  const { identity, selectors } = await loadNoopIdentity(
    canonical.collectionRoot,
    selector
  );
  const source = resolveNoopSource(identity, options);
  if (source === null) {
    return null;
  }
  const target = prepareNoopTarget(
    identity,
    source,
    options.preflight === true
  );
  if (target === null || target.status === "error") {
    return target;
  }
  return await executeNoopRename(canonical, identity, source, target.plan, {
    selectors,
    preflight: options.preflight === true
  });
}

async function loadNoopIdentity(root: string, selector: string) {
  const published =
    parseDatedDecisionId(selector) === null
      ? null
      : await loadCandidateIdentityContext(root, []);
  const selectors = published?.collection.formal.some(
    ({ id }) => id === selector
  )
    ? []
    : [selector];
  const identity =
    selectors.length === 0 && published !== null
      ? published
      : await loadCandidateIdentityContext(root, selectors);
  return { identity, selectors };
}

/** 不可能同身份的请求不进入局部 no-op 读取，而继续原严格更名流程。 */
function matchingRenameSelectors(options: DecisionRenameOptions): boolean {
  const rawSource = normalizeDecisionSelectorInput(options.source);
  const rawTarget = normalizeDecisionSelectorInput(options.target);
  const sourceDate = parseDatedDecisionId(rawSource);
  const targetDate = parseDatedDecisionId(rawTarget);
  if (
    sourceDate !== null &&
    targetDate !== null &&
    sourceDate.id !== targetDate.id
  )
    return false;
  return (sourceDate?.name ?? rawSource) === (targetDate?.name ?? rawTarget);
}

function resolveNoopSource(
  identity: CandidateIdentityContext,
  options: DecisionRenameOptions
): NoopSource | null {
  const selector = normalizeDecisionSelectorInput(options.source);
  const dated = parseDatedDecisionId(selector);
  const matches = identity.records.filter((record) =>
    dated === null
      ? identityName(record.decisionId) === selector
      : record.decisionId === dated.id
  );
  if (matches.length !== 1) {
    return null;
  }
  const source = matches[0]!;
  if (parseDatedDecisionId(source.decisionId) === null) {
    return null;
  }
  if (
    identity.collection.indexStatus === "missing" &&
    !identity.collection.candidateById.has(source.decisionId)
  ) {
    return null;
  }
  const target = normalizeDecisionSelectorInput(options.target);
  const name = identityName(source.decisionId);
  if (target !== source.decisionId && target !== name) {
    return null;
  }
  if (!isDecisionId(source.decisionId)) {
    return null;
  }
  return { ...source, decisionId: source.decisionId, name };
}

/** 同名不是身份冲突；实际目标位置必须仍为所选来源位置。 */
function prepareNoopTarget(
  identity: CandidateIdentityContext,
  source: NoopSource,
  preflight: boolean
):
  | Readonly<{ status: "ready"; plan: DecisionRenamePlan }>
  | Extract<DecisionRenameResult, { status: "error" }>
  | null {
  const { name } = source;
  const status = identity.collection.candidateById.has(source.decisionId)
    ? "candidate"
    : source.sourcePath.startsWith("archive/")
      ? "archived"
      : "active";
  const occupied = new Set(
    identity.records
      .filter((record) => record.sourcePath !== source.sourcePath)
      .map((record) => record.sourcePath)
  );
  const targetPath = sourcePathForDecisionRename(
    source.decisionId,
    name,
    status,
    occupied
  );
  if (targetPath !== source.sourcePath) return null;
  return { status: "ready", plan: noopRenamePlan(source, preflight) };
}

function noopRenamePlan(
  source: NoopSource,
  preflight: boolean
): DecisionRenamePlan {
  return {
    oldId: source.decisionId,
    newId: source.decisionId,
    oldName: source.name,
    newName: source.name,
    oldSourcePath: source.sourcePath,
    newSourcePath: source.sourcePath,
    affectedCandidateRelationCount: 0,
    affectedEstablishedRelationCount: 0,
    outcome: preflight ? "preflight" : "ready"
  };
}

/** 同份安全字节核对身份，既有 index 只作为 guard，绝不规范化正文或索引。 */
async function captureNoopRenamePlan(
  location: NoopLocation,
  source: NoopSource,
  plan: DecisionRenamePlan,
  published: boolean
): Promise<RecordTransactionPlan<DecisionRenamePlan>> {
  const sourcePath = path.join(location.collectionRoot, source.sourcePath);
  const indexPath = path.join(location.collectionRoot, "decision-index.json");
  const before = await readRecordFileSnapshot(
    location.workspaceRoot,
    sourcePath
  );
  const text =
    before === null
      ? null
      : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          before.bytes
        );
  if (text === null || decisionIdFromMarkdown(text) !== source.decisionId)
    throw new Error(
      "Decision no-op rename source identity changed: " + source.sourcePath
    );
  const indexBefore = await readRecordFileSnapshot(
    location.workspaceRoot,
    indexPath
  );
  if (published)
    verifyNoopPublishedSource(indexBefore, source, text, indexPath);
  return {
    value: plan,
    root: location.workspaceRoot,
    writes: [],
    index: null,
    guards: [
      { path: sourcePath, before },
      { path: indexPath, before: indexBefore }
    ]
  };
}

function verifyNoopPublishedSource(
  indexBefore: RecordFileSnapshot | null,
  source: NoopSource,
  text: string,
  indexPath: string
): void {
  const loaded =
    indexBefore === null
      ? null
      : parseDecisionIndex(
          new TextDecoder("utf-8", { fatal: true }).decode(indexBefore.bytes),
          indexPath
        );
  const entry =
    loaded?.status === "ok"
      ? loaded.value.entries[source.decisionId]
      : undefined;
  if (
    entry?.sourcePath !== source.sourcePath ||
    loaded?.status !== "ok" ||
    decisionSourceRevision([
      { decisionId: source.decisionId, sourcePath: source.sourcePath, text }
    ]).entries[source.decisionId] !==
      loaded.value.sourceRevision.entries[source.decisionId]
  )
    throw new Error(
      "Selected Decision source differs from published index; run sync-index: " +
        source.sourcePath
    );
}

async function executeNoopRename(
  location: NoopLocation,
  identity: CandidateIdentityContext,
  source: NoopSource,
  plan: DecisionRenamePlan,
  options: Readonly<{ selectors: readonly string[]; preflight: boolean }>
): Promise<DecisionRenameResult> {
  const prepared = await captureNoopRenamePlan(
    location,
    source,
    plan,
    identity.collection.formal.some(({ id }) => id === source.decisionId)
  );
  const members = identitySignature(identity.records);
  const fresh = async () => {
    const current = await loadCandidateIdentityContext(
      location.collectionRoot,
      options.selectors
    );
    if (identitySignature(current.records) !== members)
      throw new Error("Decision identities changed during no-op rename.");
  };
  const result = await runRecordTransaction({
    preflight: options.preflight,
    prepare: async () => prepared,
    fresh,
    verify: fresh,
    verifyRecovered: fresh
  });
  if (result.status === "error")
    return {
      ...decisionFailure(
        result.errors.map((error) =>
          transactionFileSystemDiagnostic(
            "Decision no-op rename safety verification failed.",
            source.sourcePath,
            error
          )
        )
      ),
      plan: null
    };
  return {
    changed: false,
    diagnostics: [],
    errors: [],
    outcome: options.preflight ? "preflight" : "committed",
    plan,
    status: "ok"
  };
}
function identitySignature(
  records: readonly Readonly<{ decisionId: string; sourcePath: string }>[]
): string {
  return JSON.stringify(
    [...records].sort((left, right) =>
      left.sourcePath.localeCompare(right.sourcePath)
    )
  );
}

function identityName(id: string): string {
  if (!isDecisionId(id))
    throw new Error("Invalid visible Decision identity: " + id);
  return decisionNameFromId(id);
}
