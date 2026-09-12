#!/usr/bin/env node

import process from "node:process";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  diagnosticFromError,
  renderInvestigationDiagnostic
} from "./diagnostics.ts";
import {
  runCandidates,
  runDiscardCandidate,
  runShowCandidate
} from "./cli-candidates.ts";
import { runNew, runPublish } from "./cli-candidate-create.ts";
import type {
  InvestigationReportCliIo,
  InvestigationReportCliOptions,
  ParsedCli
} from "./cli-contract.ts";
import { printHelp } from "./cli-help.ts";
import { cliInvalid } from "./cli-io.ts";
import {
  runCheck,
  runDiscard,
  runRename,
  runStage,
  runSync
} from "./cli-maintenance-commands.ts";
import { parseCliWithRelationEvents } from "./cli-parser.ts";
import { runList, runSearch, runShow, runTrace } from "./cli-query-commands.ts";
import { runSetRelations } from "./cli-relation-commands.ts";

const processCliIo: InvestigationReportCliIo = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text)
};

export async function runInvestigationReportCheckCli(
  argv: readonly string[] = process.argv.slice(2),
  options: InvestigationReportCliOptions = {}
): Promise<number> {
  const io = options.io ?? processCliIo;
  const parsed = parseCliWithRelationEvents(argv);
  if (parsed.status === "help") {
    printHelp(parsed.command, io);
    return 0;
  }
  if (parsed.status === "invalid") return cliInvalid(parsed.error, io);
  return await runCommand(parsed.value, io);
}

type CommandRunner = (
  input: ParsedCli,
  io: InvestigationReportCliIo
) => Promise<number>;

const commandRunners: Readonly<Record<ParsedCli["command"], CommandRunner>> = {
  candidates: runCandidates,
  check: runCheck,
  discard: runDiscard,
  "discard-candidate": runDiscardCandidate,
  list: runList,
  new: runNew,
  publish: runPublish,
  rename: runRename,
  search: runSearch,
  "set-relations": runSetRelations,
  show: runShow,
  "show-candidate": runShowCandidate,
  "stage-index": runStage,
  "sync-index": runSync,
  trace: runTrace
};

async function runCommand(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  return await commandRunners[input.command](input, io);
}

export {
  createInvestigationCandidate,
  createInvestigationCandidateFromCli,
  listInvestigationCandidates,
  showInvestigationCandidate
} from "./candidate.ts";
export { discardInvestigationCandidate } from "./candidate-discard.ts";
export { discardInvestigationReport } from "./discard.ts";
export { publishInvestigationCandidates } from "./publish.ts";
export { renameInvestigationRecord } from "./rename.ts";
export {
  queryInvestigationIndex,
  searchInvestigationReports,
  showInvestigationReport,
  traceInvestigationReports
} from "./query.ts";
export { setInvestigationRelations } from "./relation-transaction.ts";
export { stageInvestigationIndex } from "./staging.ts";
export {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "./validation.ts";
export type {
  InvestigationCandidate,
  InvestigationCandidateCreateOptions,
  InvestigationCandidateCreateResult,
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult,
  InvestigationCandidateListOptions,
  InvestigationCandidateListResult,
  InvestigationCandidatePublishOptions,
  InvestigationCandidatePublishResult,
  InvestigationCandidateReadiness,
  InvestigationCandidateShowOptions,
  InvestigationCandidateShowResult,
  InvestigationIndexQueryOptions,
  InvestigationIndexQueryResult,
  InvestigationListAppliedFilters,
  InvestigationListFacets,
  InvestigationListMonthFacet,
  InvestigationListTagFacet,
  InvestigationListTimeFacets,
  InvestigationIndexStageDiagnostic,
  InvestigationIndexStageOptions,
  InvestigationIndexStageResult,
  InvestigationIndexState,
  InvestigationIndexSyncOptions,
  InvestigationIndexSyncResult,
  InvestigationReportDiscardOptions,
  InvestigationReportDiscardResult,
  InvestigationRelation,
  InvestigationRelationReview,
  InvestigationRelationReviewAction,
  InvestigationRelationReviewPhase,
  InvestigationRelationReviewSource,
  InvestigationFilterRelation,
  InvestigationRelationFilterContext,
  InvestigationRelationSetOptions,
  InvestigationRelationSetResult,
  InvestigationRelationType,
  InvestigationReportCheckOptions,
  InvestigationReportCheckResult,
  InvestigationReportShowOptions,
  InvestigationReportShowResult,
  InvestigationReportTraceOptions,
  InvestigationReportTraceResult,
  InvestigationReportTraceSuccess,
  InvestigationTraceEntry,
  InvestigationSearchEntry,
  InvestigationSearchOptions,
  InvestigationSearchResult,
  InvestigationContentSearchEntry,
  InvestigationMetadataMatchedRelation,
  InvestigationMetadataSearchEntry,
  InvestigationMetadataSearchField
} from "./types.ts";
export type {
  InvestigationRenameOptions,
  InvestigationRenamePlan,
  InvestigationRenameResult
} from "./rename.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runInvestigationReportCheckCli();
  } catch (error) {
    for (const line of renderInvestigationDiagnostic(
      diagnosticFromError({
        code: "investigation-report.unhandled-failure",
        error,
        reason: "the command stopped unexpectedly",
        recovery: "inspect the reported failure and retry the command",
        target: "investigation-report command"
      })
    ))
      console.error(line);
    process.exitCode = 1;
  }
}
