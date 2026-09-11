import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import { directInvestigationResourceIssues } from "./resource-file-validation.ts";
import {
  discoverVisibleInvestigationResourceIds,
  prepareInvestigationResourceRoot,
  type ResourceRoot,
  type ResourceRootPreparation
} from "./resource-root.ts";
import {
  investigationResourceOwnerReportId,
  investigationResourcesDirectoryName
} from "./resource-reference.ts";

export type InvestigationResourceValidationResult = Readonly<{
  errors: string[];
  warnings: string[];
}>;

/** Maps each report to the valid resource IDs it directly declares. */
export type InvestigationResourceReferencesByReport = ReadonlyMap<
  string,
  ReadonlySet<string>
>;

export async function validateReferencedInvestigationResources(
  investigationsDirectory: string,
  resourceIds: readonly string[],
  signal?: AbortSignal
): Promise<string[]> {
  const ids = uniqueSorted(resourceIds);
  if (ids.length === 0) return [];
  const prepared = await prepareInvestigationResourceRoot(
    investigationsDirectory
  );
  if (prepared.status === "invalid") return prepared.errors;
  if (prepared.status === "missing") return ids.map(missingResourceIssue);
  return await validateResourceIds(prepared, ids, signal);
}

export async function validateCandidateInvestigationResources(
  investigationsDirectory: string,
  candidateResourceIds: readonly string[],
  authoringReferencesByReport: InvestigationResourceReferencesByReport,
  signal?: AbortSignal
): Promise<string[]> {
  const directErrors = await validateReferencedInvestigationResources(
    investigationsDirectory,
    candidateResourceIds,
    signal
  );
  const ownerErrors = uniqueSorted(candidateResourceIds).flatMap((id) =>
    ownerIssues(id, authoringReferencesByReport)
  );
  return uniqueSorted([...directErrors, ...ownerErrors]);
}

export async function validateFullInvestigationResources(
  investigationsDirectory: string,
  referencesByReport: InvestigationResourceReferencesByReport,
  options: Readonly<{
    authoringReferencesByReport?: InvestigationResourceReferencesByReport;
    signal?: AbortSignal;
  }> = {}
): Promise<InvestigationResourceValidationResult> {
  const referencedIds = referencedResourceIds(referencesByReport);
  const authoringReferences =
    options.authoringReferencesByReport ?? referencesByReport;
  const errors = referencedIds.flatMap((id) =>
    ownerIssues(id, referencesByReport)
  );
  const prepared = await prepareInvestigationResourceRoot(
    investigationsDirectory
  );
  if (prepared.status === "invalid")
    return validationResult([...errors, ...prepared.errors], []);
  if (prepared.status === "missing")
    return missingRootValidation(
      prepared,
      referencedIds,
      authoringReferences,
      errors
    );
  return await readyRootValidation(
    prepared,
    referencedIds,
    authoringReferences,
    errors,
    options.signal
  );
}

function referencedResourceIds(
  referencesByReport: InvestigationResourceReferencesByReport
): string[] {
  return uniqueSorted(
    [...referencesByReport.values()].flatMap((ids) => [...ids])
  );
}

function missingRootValidation(
  prepared: Extract<ResourceRootPreparation, { status: "missing" }>,
  referencedIds: readonly string[],
  authoringReferences: InvestigationResourceReferencesByReport,
  errors: string[]
): InvestigationResourceValidationResult {
  errors.push(...referencedIds.map(missingResourceIssue));
  const warnings =
    prepared.membership.mode === "version-control"
      ? unreferencedMissingRootWarnings(
          prepared.membership.files,
          referencedIds,
          authoringReferences
        )
      : [];
  return validationResult(errors, warnings);
}

function unreferencedMissingRootWarnings(
  files: ReadonlySet<string>,
  referencedIds: readonly string[],
  references: InvestigationResourceReferencesByReport
): string[] {
  const referenced = new Set(referencedIds);
  return [...files].flatMap((id) =>
    referenced.has(id)
      ? []
      : [...ownerIssues(id, references), missingResourceIssue(id)]
  );
}

async function readyRootValidation(
  prepared: Extract<ResourceRootPreparation, { status: "ready" }>,
  referencedIds: readonly string[],
  authoringReferences: InvestigationResourceReferencesByReport,
  errors: string[],
  signal: AbortSignal | undefined
): Promise<InvestigationResourceValidationResult> {
  const visibleIds = await visibleResourceIds(prepared, signal, errors);
  errors.push(...(await validateResourceIds(prepared, referencedIds, signal)));
  const warnings = await unreferencedResourceWarnings(
    prepared,
    visibleIds,
    new Set(referencedIds),
    authoringReferences,
    signal
  );
  return validationResult(errors, warnings);
}

async function visibleResourceIds(
  prepared: Extract<ResourceRootPreparation, { status: "ready" }>,
  signal: AbortSignal | undefined,
  errors: string[]
): Promise<string[]> {
  try {
    return await discoverVisibleInvestigationResourceIds(prepared, signal);
  } catch (error) {
    errors.push(
      `${investigationResourcesDirectoryName} membership could not be fully inspected: ${errorText(error)}`
    );
    return [];
  }
}

async function validateResourceIds(
  prepared: ResourceRoot,
  ids: readonly string[],
  signal: AbortSignal | undefined
): Promise<string[]> {
  const errors: string[] = [];
  for (const id of ids) {
    throwIfAborted(signal, "investigation resource validation was aborted");
    errors.push(...(await directInvestigationResourceIssues(prepared, id)));
  }
  return errors;
}

async function unreferencedResourceWarnings(
  prepared: ResourceRoot,
  visibleIds: readonly string[],
  referencedIds: ReadonlySet<string>,
  authoringReferences: InvestigationResourceReferencesByReport,
  signal: AbortSignal | undefined
): Promise<string[]> {
  const warnings: string[] = [];
  for (const id of visibleIds) {
    if (referencedIds.has(id)) continue;
    throwIfAborted(signal, "investigation resource validation was aborted");
    warnings.push(
      ...ownerIssues(id, authoringReferences),
      ...(await directInvestigationResourceIssues(prepared, id))
    );
  }
  return warnings;
}

function ownerIssues(
  id: string,
  referencesByReport: InvestigationResourceReferencesByReport
): string[] {
  const ownerReportId = investigationResourceOwnerReportId(id);
  if (ownerReportId === null)
    return [
      `${resourcePath(id)} must use a safe, normalized resource id with an owner report prefix`
    ];
  const ownerReferences = referencesByReport.get(ownerReportId);
  if (ownerReferences === undefined)
    return [`${resourcePath(id)} owner report ${ownerReportId} does not exist`];
  return ownerReferences.has(id)
    ? []
    : [
        `${resourcePath(id)} must be referenced by its owner report ${ownerReportId}`
      ];
}

function validationResult(
  errors: readonly string[],
  warnings: readonly string[]
): InvestigationResourceValidationResult {
  return { errors: uniqueSorted(errors), warnings: uniqueSorted(warnings) };
}
function throwIfAborted(
  signal: AbortSignal | undefined,
  message: string
): void {
  if (signal?.aborted === true) throw new Error(message);
}
function resourcePath(id: string): string {
  return `${investigationResourcesDirectoryName}/${id}`;
}
function missingResourceIssue(id: string): string {
  return `${resourcePath(id)} does not exist`;
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
