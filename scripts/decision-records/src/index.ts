import {
  loadHeadDecisionPaths,
  type HeadDecisionPathsResult
} from "./head-decision-paths.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  type DecisionIndex,
  type DecisionIndexEntry,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionValidationResult,
  type ExpectedIndex
} from "./types.ts";

export type DecisionValidationContext = {
  headDecisionPaths: HeadDecisionPathsResult;
  result: DecisionValidationResult;
};

export type DecisionValidationOptions = {
  checkIndexText?: boolean;
  scanErrorPolicy?: "include" | "omit";
};

export function expectedIndex(
  scan: DecisionScan,
  sourceEntries: readonly DecisionIndexEntry[] = scan.index?.records ?? []
): ExpectedIndex {
  const errors: string[] = [];
  const recordByPath = new Map(scan.records.map((record) => [record.relativePath, record]));
  const entries: DecisionIndexEntry[] = [];

  for (const sourceEntry of sourceEntries) {
    const record = recordByPath.get(sourceEntry.path);
    if (!record?.document) {
      errors.push(scan.indexRelativePath + " references missing decision " + sourceEntry.path);
      continue;
    }

    entries.push({
      path: record.relativePath,
      status: sourceEntry.status,
      createdAt: sourceEntry.createdAt,
      title: record.document.title,
      purpose: record.document.purpose,
      background: record.document.background,
      decision: record.document.decision,
      relations: record.document.relations
    });
  }

  if (errors.length > 0) {
    return { errors, text: null };
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));
  const index: DecisionIndex = {
    schemaVersion: 3,
    records: entries
  };

  return {
    errors,
    text: JSON.stringify(index, null, 2) + "\n"
  };
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
    result: validateDecisionScan(scan, headDecisionPaths, validationOptions)
  };
}

export function validateDecisionScan(
  scan: DecisionScan,
  headDecisionPaths: HeadDecisionPathsResult,
  options: DecisionValidationOptions = {}
): DecisionValidationResult {
  const errors = options.scanErrorPolicy === "omit"
    ? []
    : [...scan.errors];
  errors.push(...headDecisionPaths.errors);
  if (headDecisionPaths.errors.length === 0) {
    errors.push(...headPathConsistencyErrors(scan, headDecisionPaths.paths));
  }
  const generated = expectedIndex(scan);
  errors.push(...generated.errors);

  if (options.checkIndexText !== false
    && generated.text !== null
    && scan.indexText.replace(/\r\n/g, "\n") !== generated.text) {
    errors.push(
      scan.indexRelativePath
      + " is out of sync; run sync-index --write"
    );
  }

  return {
    activeCount: scan.records.filter((record) => record.status === "active").length,
    archivedCount: scan.records.filter((record) => record.status === "archived").length,
    areaCount: scan.areaIds.size,
    decisionCount: scan.records.length,
    errors,
    scan
  };
}

function headPathConsistencyErrors(
  scan: DecisionScan,
  headPaths: ReadonlySet<string>
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

  for (const record of scan.records.filter((candidate) => candidate.indexed)) {
    for (const relation of record.projection.relations) {
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
