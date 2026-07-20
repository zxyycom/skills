import { scanDecisionRecords } from "./scan.ts";
import {
  type DecisionIndex,
  type DecisionIndexEntry,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionValidationResult,
  type ExpectedIndex
} from "./types.ts";

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
  const scan = await scanDecisionRecords(options);
  const errors = [...scan.errors];
  const generated = expectedIndex(scan);
  errors.push(...generated.errors);

  if (generated.text !== null
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
