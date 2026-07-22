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
  allowEmptyDecisionSet?: boolean;
  checkIndexText?: boolean;
  scanErrorPolicy?: "include" | "omit" | "source-only";
};

export function expectedIndex(
  scan: DecisionScan
): ExpectedIndex {
  const errors: string[] = [];
  const entries: DecisionIndexEntry[] = [];

  for (const record of scan.records.filter((candidate) => candidate.markdownExists)) {
    if (!record.document) {
      errors.push("Cannot generate index from invalid decision " + record.relativePath);
      continue;
    }

    const { alignment, createdAt, status } = record.document;
    const projection = {
      title: record.document.title,
      purpose: record.document.purpose,
      background: record.document.background,
      decision: record.document.decision,
      relations: record.document.relations
    };
    entries.push(status === "active"
      ? {
          path: record.relativePath,
          status: "active",
          alignment,
          createdAt,
          ...projection
        }
      : {
          path: record.relativePath,
          status: "archived",
          alignment: null,
          createdAt,
          ...projection
        });
  }

  if (entries.length === 0) {
    errors.push("Cannot generate an empty decision index");
  }

  if (errors.length > 0) {
    return { errors, text: null };
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));
  const index: DecisionIndex = {
    schemaVersion: 4,
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
    : options.scanErrorPolicy === "source-only"
      ? [...scan.sourceErrors]
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
  const generated = options.allowEmptyDecisionSet && !hasDecisionMarkdown
    ? { errors: [], text: null }
    : expectedIndex(scan);
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
    alignedCount: scan.records.filter((record) => (
      record.status === "active" && record.alignment === "aligned"
    )).length,
    archivedCount: scan.records.filter((record) => record.status === "archived").length,
    areaCount: scan.areaIds.size,
    decisionCount: scan.records.length,
    errors,
    scan,
    unalignedCount: scan.records.filter((record) => (
      record.status === "active" && record.alignment === "unaligned"
    )).length
  };
}

function headPathConsistencyErrors(
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

  for (const record of scan.records.filter((candidate) => sourceOnly
    ? candidate.document !== null
    : candidate.document !== null || candidate.indexed)) {
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
