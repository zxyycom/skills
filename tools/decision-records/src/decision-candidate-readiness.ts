import path from "node:path";
import type { CandidateSource } from "../../record-operations/src/candidate.ts";
import { readRecordSource } from "../../record-operations/src/source.ts";
import type { CandidateIdentityContext } from "./decision-candidate-discovery.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import { isDecisionId } from "./decision-path.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import {
  scanDecisionCandidateScaffold,
  scanSourceFiles
} from "./scan-records.ts";
import type { DecisionId, DecisionRecord } from "./types.ts";
import type { SourceFile } from "./scan-contracts.ts";

type CandidateReadPhase = Readonly<{
  identity: CandidateIdentityContext;
  availableDecisionIds: ReadonlySet<DecisionId>;
}>;

export function candidateReadPhase(
  identity: CandidateIdentityContext
): CandidateReadPhase {
  return {
    identity,
    availableDecisionIds: new Set(
      identity.records.map(({ decisionId }) => decisionId).filter(isDecisionId)
    )
  };
}

export async function readDecisionCandidate(
  source: CandidateSource,
  phase: CandidateReadPhase
): Promise<
  | Readonly<{ status: "invalid"; errors: readonly string[] }>
  | Readonly<{
      status: "ok";
      value: DecisionRecord;
      warnings: readonly string[];
    }>
> {
  const { record, errors } = await scanCandidateSource(source, phase);
  if (!record.scaffoldValid) {
    return { status: "invalid", errors };
  }
  errors.push(...(await validateDirectCandidateDependencies(record, phase)));
  return { status: "ok", value: record, warnings: errors };
}

async function scanCandidateSource(
  source: CandidateSource,
  phase: CandidateReadPhase
): Promise<Readonly<{ record: DecisionRecord; errors: string[] }>> {
  const errors: string[] = [];
  const record = await scanDecisionCandidateScaffold({
    indexRelativePath: decisionIndexFileName,
    sourceErrors: errors,
    sourceFile: candidateSourceFile(source, phase)
  });
  return { record, errors };
}

function candidateSourceFile(
  source: CandidateSource,
  phase: CandidateReadPhase
): Readonly<SourceFile> {
  return {
    decisionId: source.id as DecisionId,
    sourcePath: source.sourcePath,
    decisionPath: path.join(
      phase.identity.decisionsDirectory,
      source.sourcePath
    ),
    sourceText: source.text
  };
}

async function validateDirectCandidateDependencies(
  record: DecisionRecord,
  phase: CandidateReadPhase
): Promise<string[]> {
  const warnings: string[] = [];
  for (const relation of record.projection.relations) {
    if (!phase.identity.collection.identityById.has(relation.target)) {
      warnings.push(
        "Candidate relation target is not yet established: " + relation.target
      );
      continue;
    }
    const source = await directCandidateDependency(
      relation.target,
      phase.identity
    );
    const errors = await candidateDependencyErrors(source, phase);
    if (errors.length > 0) {
      throw new Error(
        "Direct candidate dependency is invalid: " + errors.join("; ")
      );
    }
  }
  return warnings;
}

async function candidateDependencyErrors(
  source: CandidateSource,
  phase: CandidateReadPhase
): Promise<string[]> {
  if (phase.identity.collection.candidateById.has(source.id))
    return (await scanCandidateSource(source, phase)).errors;
  const errors: string[] = [];
  await scanSourceFiles({
    availableDecisionIds: phase.availableDecisionIds,
    index: null,
    indexErrors: [],
    indexRelativePath: decisionIndexFileName,
    sourceErrors: errors,
    sourceFiles: [candidateSourceFile(source, phase)]
  });
  return errors;
}

async function directCandidateDependency(
  id: DecisionId,
  identity: CandidateIdentityContext
): Promise<CandidateSource> {
  const dependency = identity.collection.identityById.get(id);
  if (dependency === undefined) {
    throw new Error("Direct candidate dependency is unavailable: " + id);
  }
  const candidate = identity.collection.candidateById.get(id);
  if (
    identity.collection.indexStatus === "missing" &&
    candidate === undefined
  ) {
    throw new Error(
      "Direct formal dependency requires explicit index recovery: " + id
    );
  }
  const text =
    candidate?.text ??
    (await readRecordSource({
      collectionRoot: identity.decisionsDirectory,
      sourcePath: dependency.sourcePath,
      id,
      idFromMarkdown: decisionIdFromMarkdown
    }));
  return { ...dependency, text };
}
