import {
  decisionIndexDiagnosticMessages,
  syncDecisionIndex
} from "./decision-state-index.ts";
import {
  loadHeadDecisionPaths,
  type HeadDecisionPathsResult
} from "./head-decision-paths.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionValidationResult
} from "./types.ts";

export type DecisionValidationContext = {
  headDecisionPaths: HeadDecisionPathsResult;
  result: DecisionValidationResult;
};

export type DecisionValidationOptions = {
  allowEmptyDecisionSet?: boolean;
  checkIndexText?: boolean;
  scanErrorPolicy?:
    | "allow-activation-candidates"
    | "include"
    | "omit"
    | "source-only";
};

export type DecisionIndexSourceSelectionOptions = {
  includeUnindexedPaths?: ReadonlySet<string>;
};

export type DecisionIndexSourceSelection = {
  errors: string[];
  relativePaths: string[];
};

export function selectDecisionIndexSourcePaths(
  scan: DecisionScan,
  options: DecisionIndexSourceSelectionOptions = {}
): DecisionIndexSourceSelection {
  const errors: string[] = [];
  const relativePaths: string[] = [];
  const { includeUnindexedPaths } = options;

  for (const record of scan.records.filter((candidate) => (
    candidate.markdownExists
    && !candidate.activationCandidate
    && (includeUnindexedPaths === undefined
      || candidate.indexed
      || includeUnindexedPaths.has(candidate.relativePath))
  ))) {
    relativePaths.push(record.relativePath);
  }

  if (relativePaths.length === 0) {
    errors.push("Cannot generate an empty decision index");
  }

  return { errors, relativePaths };
}

export async function validateDecisionRecords(
  options: DecisionScanOptions = {}
): Promise<DecisionValidationResult> {
  return (await loadDecisionValidationContext(options)).result;
}

export async function loadDecisionValidationContext(
  options: DecisionScanOptions = {},
  validationOptions: DecisionValidationOptions = {}
): Promise<DecisionValidationContext> {
  const scan = await scanDecisionRecords(options);
  const headDecisionPaths = scan.decisionsDirectoryAvailable
    ? await loadHeadDecisionPaths(scan.decisionsDirectory)
    : { errors: [], paths: new Set<string>() };
  return {
    headDecisionPaths,
    result: await validateDecisionScan(scan, headDecisionPaths, validationOptions)
  };
}

export async function validateDecisionScan(
  scan: DecisionScan,
  headDecisionPaths: HeadDecisionPathsResult,
  options: DecisionValidationOptions = {}
): Promise<DecisionValidationResult> {
  const candidateErrorSet = new Set(scan.activationCandidateErrors);
  const errors = options.scanErrorPolicy === "omit"
    ? []
    : options.scanErrorPolicy === "source-only"
      ? [...scan.sourceErrors]
      : options.scanErrorPolicy === "allow-activation-candidates"
        ? scan.errors.filter((error) => !candidateErrorSet.has(error))
        : [...scan.errors];
  errors.push(...headDecisionPaths.errors);
  if (headDecisionPaths.errors.length === 0) {
    errors.push(...headPathConsistencyErrors(
      scan,
      headDecisionPaths.paths,
      options.scanErrorPolicy === "source-only"
    ));
  }
  const hasDecisionMarkdown = scan.records.some((record) => record.markdownExists);
  const selection = options.allowEmptyDecisionSet && !hasDecisionMarkdown
    ? { errors: [], relativePaths: [] }
    : selectDecisionIndexSourcePaths(scan);
  errors.push(...selection.errors);

  if (
    options.checkIndexText !== false
    && selection.relativePaths.length > 0
    && scan.sourceErrors.length === 0
  ) {
    const checked = await syncDecisionIndex({
      decisionsDirectory: scan.decisionsDirectory,
      mode: "check",
      relativePaths: selection.relativePaths
    });
    if (checked.status === "error") {
      if (
        checked.state === "index-invalid"
        || checked.state === "index-missing"
        || checked.state === "index-stale"
      ) {
        errors.push(
          scan.indexRelativePath
          + " is out of sync; run sync-index --write"
        );
      } else {
        errors.push(...decisionIndexDiagnosticMessages(
          checked.diagnostics,
          scan.indexRelativePath
        ));
      }
    }
  }

  const establishedRecords = scan.records.filter(
    (record) => !record.activationCandidate
  );

  return {
    activationCandidateCount: scan.records.length - establishedRecords.length,
    activeCount: establishedRecords.filter((record) => record.status === "active").length,
    alignedCount: establishedRecords.filter((record) => (
      record.status === "active" && record.alignment === "aligned"
    )).length,
    archivedCount: establishedRecords.filter(
      (record) => record.status === "archived"
    ).length,
    areaCount: scan.areaIds.size,
    decisionCount: establishedRecords.length,
    errors,
    scan,
    unalignedCount: establishedRecords.filter((record) => (
      record.status === "active" && record.alignment === "unaligned"
    )).length
  };
}

export function headPathConsistencyErrors(
  scan: DecisionScan,
  headPaths: ReadonlySet<string>,
  sourceOnly = false
): string[] {
  const errors: string[] = [];
  const workingPaths = new Set(
    scan.records
      .filter((record) => record.markdownExists)
      .map((record) => record.relativePath)
  );
  for (const headPath of headPaths) {
    if (!workingPaths.has(headPath)) {
      errors.push(
        "Decision file present in Git HEAD is missing from the working tree: "
        + headPath
        + "; established decision paths must not be deleted or renamed"
      );
    }
  }

  for (const record of scan.records.filter((candidate) => (
    candidate.activationCandidate && headPaths.has(candidate.relativePath)
  ))) {
    errors.push(
      "Decision file present in Git HEAD cannot remain an unactivated candidate: "
      + record.relativePath
    );
  }

  for (const record of scan.records.filter((candidate) => sourceOnly
    ? candidate.bodyValid
    : candidate.bodyValid || candidate.indexed)) {
    const relations = record.document?.relations ?? record.projection.relations;
    for (const relation of relations) {
      if (!headPaths.has(relation.target)) {
        errors.push(
          record.relativePath
          + " relationship "
          + relation.type
          + " target is not present in Git HEAD: "
          + relation.target
        );
      }
    }
  }
  return errors;
}
