import {
  prepareCandidateReadContext,
  type CandidateReadContext
} from "./candidate-read-context.ts";
export { prepareCandidateReadContext } from "./candidate-read-context.ts";
export type { CandidateReadContext } from "./candidate-read-context.ts";
import { discoverInvestigationCandidates } from "./candidate-discovery.ts";
import path from "node:path";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "../diagnostics.ts";
import { validateInvestigationBody } from "../records/markdown-body.ts";
import { normalizeMarkdownNewlines } from "../records/markdown-values.ts";
import { validateCandidateInvestigationResources } from "../resources/resources.ts";
import { investigationResourcesDirectoryName } from "../resources/resource-reference.ts";
import { errorText, uniqueSorted } from "./candidate-support.ts";
import type {
  InvestigationCandidate,
  ParsedInvestigationReport
} from "../types.ts";

type CandidateReadFailure = Readonly<{
  kind: "scaffold-invalid" | "operation";
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  status: "error";
}>;
export async function readInvestigationCandidate(
  investigationsDirectory: string,
  id: string,
  context?: CandidateReadContext
): Promise<
  { status: "ok"; value: InvestigationCandidate } | CandidateReadFailure
> {
  try {
    const prepared =
      context ??
      (await prepareCandidateReadContext(
        investigationsDirectory,
        await discoverInvestigationCandidates(investigationsDirectory),
        [id]
      ));
    const source = prepared.sources.get(id);
    if (source === undefined) return missingCandidate(id);
    const target = path.join(investigationsDirectory, source.sourcePath);
    return await parsedCandidateResult(
      investigationsDirectory,
      id,
      target,
      source.text,
      prepared
    );
  } catch (error) {
    return {
      status: "error",
      kind: "operation",
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-read-failed",
          error,
          reason: "the selected investigation candidate could not be read",
          recovery:
            "restore access to the selected candidate and its required owners, then retry",
          target: investigationsDirectory
        })
      ],
      errors: [`${id} investigation candidate could not be read`]
    };
  }
}

function missingCandidate(id: string): CandidateReadFailure {
  return {
    diagnostics: [],
    kind: "operation",
    errors: [`${id} investigation candidate could not be read`],
    status: "error"
  };
}

async function parsedCandidateResult(
  investigationsDirectory: string,
  id: string,
  target: string,
  markdown: string,
  context: CandidateReadContext
): Promise<
  { status: "ok"; value: InvestigationCandidate } | CandidateReadFailure
> {
  const scaffold = context.parsed.get(id)!;
  const bodyErrors: string[] = [];
  validateInvestigationBody(
    normalizeMarkdownNewlines(markdown).split("\n"),
    scaffold.report?.frontmatter.endLine ?? 0,
    id,
    bodyErrors,
    {}
  );
  const scaffoldErrors = uniqueSorted([
    ...scaffold.frontmatterErrors,
    ...scaffold.bodyErrors
  ]);
  if (scaffoldErrors.length > 0)
    return {
      status: "error",
      kind: "scaffold-invalid",
      diagnostics: [],
      errors: scaffoldErrors
    };
  const resourceErrors = await candidateResourceErrors(
    investigationsDirectory,
    id,
    scaffold,
    context
  );
  const errors = uniqueSorted([...bodyErrors, ...resourceErrors]);
  return {
    status: "ok",
    value: {
      diagnostics: [],
      errors,
      id,
      markdown,
      path: target,
      readiness: {
        scaffoldValid: true,
        bodyReady: bodyErrors.length === 0,
        resourceReady: resourceErrors.length === 0
      },
      warnings: []
    }
  };
}

async function candidateResourceErrors(
  investigationsDirectory: string,
  id: string,
  scaffold: ParsedInvestigationReport,
  context: CandidateReadContext
): Promise<string[]> {
  const errors = [...scaffold.resourceErrors];
  if (scaffold.report === null) return errors;
  try {
    const references = context.references;
    errors.push(
      ...(await validateCandidateInvestigationResources(
        investigationsDirectory,
        scaffold.report.resourceIds,
        references,
        undefined,
        context.resources
      ))
    );
    const ownerPrefix = `${id}/`;
    errors.push(
      ...context.ownerWarnings
        .filter(
          (warning) =>
            warning.startsWith(
              `${investigationResourcesDirectoryName}/${ownerPrefix}`
            ) ||
            warning.startsWith(`${investigationResourcesDirectoryName}/${id} `)
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
