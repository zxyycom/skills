import path from "node:path";
import {
  readInvestigationCandidate,
  prepareCandidateReadContext,
  type CandidateReadContext
} from "./candidate-document.ts";
import { investigationCandidateFilePrefix } from "./candidate-path.ts";

import { buildInvestigationReportState } from "./report-validation.ts";
import type {
  InvestigationCandidate,
  InvestigationIndexState,
  InvestigationSource,
  ParsedInvestigationReport
} from "./types.ts";
import {
  preparationFailure,
  type CandidatePublishContext,
  type FormalPublishContext,
  type PublishPreparationStep
} from "./publish-preparation.ts";

export async function preparePublishCandidates(
  investigationsDirectory: string,
  ids: readonly string[],
  formal: FormalPublishContext
): Promise<PublishPreparationStep<CandidatePublishContext>> {
  const readContext = await prepareCandidateReadContext(
    investigationsDirectory,
    formal.layout,
    ids
  );
  const candidateSources: InvestigationSource[] = [];
  const candidatePaths = new Map<string, string>();
  const states = new Map(formal.formal.states);
  for (const id of ids) {
    const prepared = await preparePublishCandidate(
      investigationsDirectory,
      id,
      readContext
    );
    if (prepared.status === "error") {
      return preparationFailure(
        prepared.errors,
        prepared.diagnostics,
        formal.warnings
      );
    }
    candidatePaths.set(id, prepared.value.path);
    candidateSources.push(prepared.value.source);
    states.set(id, prepared.value.state);
  }
  return {
    status: "ok",
    value: { ...formal, candidatePaths, candidateSources, states }
  };
}

async function preparePublishCandidate(
  investigationsDirectory: string,
  id: string,
  context: CandidateReadContext
): Promise<
  PublishPreparationStep<{
    path: string;
    source: InvestigationSource;
    state: InvestigationIndexState;
  }>
> {
  const candidate = await readInvestigationCandidate(
    investigationsDirectory,
    id,
    context
  );
  if (candidate.status === "error") {
    return preparationFailure(candidate.errors, candidate.diagnostics);
  }
  if (
    !candidate.value.readiness.scaffoldValid ||
    !candidate.value.readiness.bodyReady ||
    !candidate.value.readiness.resourceReady ||
    candidate.value.markdown === null
  ) {
    return preparationFailure([
      `${id} investigation candidate is not ready for publish: ${candidate.value.errors.join("; ")}`
    ]);
  }
  return publishCandidateState(id, candidate.value, context.parsed.get(id)!);
}

function publishCandidateState(
  id: string,
  candidate: InvestigationCandidate,
  parsed: ParsedInvestigationReport
): PublishPreparationStep<{
  path: string;
  source: InvestigationSource;
  state: InvestigationIndexState;
}> {
  const built = buildInvestigationReportState(
    id,
    parsed,
    `${candidateLocatorFromPath(candidate.path)}.md`
  );
  if (built.status === "invalid") return preparationFailure(built.errors);
  return {
    status: "ok",
    value: {
      path: candidate.path,
      source: {
        id,
        sourcePath: `${candidateLocatorFromPath(candidate.path)}.md`,
        text: candidate.markdown!
      },
      state: built.state
    }
  };
}

function candidateLocatorFromPath(candidatePath: string): string {
  const basename = path.basename(candidatePath);
  if (!basename.startsWith(investigationCandidateFilePrefix)) {
    throw new Error("candidate path must use the reserved candidate filename");
  }
  return basename.slice(investigationCandidateFilePrefix.length);
}
