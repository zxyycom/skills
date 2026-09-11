import fs from "node:fs/promises";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { parseInvestigationReport } from "./markdown.ts";
import {
  validateCandidateInvestigationResources,
  validateFullInvestigationResources
} from "./resources.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { findCandidatePathForInvestigationId } from "./candidate-path.ts";
import { readCandidateAuthoringResourceReferences } from "./candidate-resource-references.ts";
import { errorText, uniqueSorted } from "./candidate-support.ts";
import type { InvestigationCandidate } from "./types.ts";

type CandidateReadFailure = Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  status: "error";
}>;
export async function readInvestigationCandidate(
  investigationsDirectory: string,
  id: string
): Promise<
  { status: "ok"; value: InvestigationCandidate } | CandidateReadFailure
> {
  const target = await findCandidatePathForInvestigationId(
    investigationsDirectory,
    id
  );
  if (target === null) return missingCandidate(id);
  const read = await readCandidateMarkdown(target, id);
  return read.status === "error"
    ? read
    : await parsedCandidateResult(
        investigationsDirectory,
        id,
        target,
        read.markdown
      );
}

function missingCandidate(id: string): CandidateReadFailure {
  return {
    diagnostics: [],
    errors: [`${id} investigation candidate could not be read`],
    status: "error"
  };
}

async function parsedCandidateResult(
  investigationsDirectory: string,
  id: string,
  target: string,
  markdown: string
): Promise<{ status: "ok"; value: InvestigationCandidate }> {
  const scaffold = parseInvestigationReport(markdown, id, {
    allowEmptyCoreSections: true
  });
  const full = parseInvestigationReport(markdown, id);
  const scaffoldErrors = uniqueSorted([
    ...scaffold.frontmatterErrors,
    ...scaffold.bodyErrors
  ]);
  const resourceErrors = await candidateResourceErrors(
    investigationsDirectory,
    id,
    scaffold,
    scaffoldErrors
  );
  const errors = uniqueSorted([
    ...scaffoldErrors,
    ...full.bodyErrors,
    ...resourceErrors
  ]);
  return {
    status: "ok",
    value: {
      diagnostics: [],
      errors,
      id,
      markdown,
      path: target,
      readiness: candidateReadiness(
        scaffoldErrors,
        full.bodyErrors,
        resourceErrors
      ),
      warnings: []
    }
  };
}

function candidateReadiness(
  scaffoldErrors: readonly string[],
  bodyErrors: readonly string[],
  resourceErrors: readonly string[]
): InvestigationCandidate["readiness"] {
  return {
    bodyReady: scaffoldErrors.length === 0 && bodyErrors.length === 0,
    resourceReady:
      scaffoldErrors.length === 0 && uniqueSorted(resourceErrors).length === 0,
    scaffoldValid: scaffoldErrors.length === 0
  };
}

async function readCandidateMarkdown(
  target: string,
  id: string
): Promise<CandidateReadFailure | { markdown: string; status: "ok" }> {
  try {
    const entry = await fs.lstat(target);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error("candidate must be a regular non-symbolic-link file");
    return { markdown: await fs.readFile(target, "utf8"), status: "ok" };
  } catch (error) {
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-read-failed",
          error,
          reason: "the selected investigation candidate could not be read",
          recovery:
            "restore read access to the candidate, then retry the query",
          target
        })
      ],
      errors: [`${id} investigation candidate could not be read`],
      status: "error"
    };
  }
}
async function candidateResourceErrors(
  investigationsDirectory: string,
  id: string,
  scaffold: ReturnType<typeof parseInvestigationReport>,
  scaffoldErrors: readonly string[]
): Promise<string[]> {
  const errors = [...scaffold.resourceErrors];
  if (scaffoldErrors.length > 0 || scaffold.report === null) return errors;
  try {
    const references = await readCandidateAuthoringResourceReferences(
      investigationsDirectory
    );
    errors.push(
      ...(await validateCandidateInvestigationResources(
        investigationsDirectory,
        scaffold.report.resourceIds,
        references
      ))
    );
    const ownerPrefix = `${id}/`;
    const all = await validateFullInvestigationResources(
      investigationsDirectory,
      references
    );
    errors.push(
      ...all.warnings
        .filter((warning) =>
          warning.startsWith(
            `${investigationResourcesDirectoryName}/${ownerPrefix}`
          )
        )
        .map(
          (warning) =>
            `candidate owner resources must be directly referenced before publish: ${warning}`
        )
    );
  } catch (error) {
    errors.push(
      `candidate resource ownership could not be inspected: ${errorText(error)}`
    );
  }
  return errors;
}
