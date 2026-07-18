import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionIndex,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionValidationResult,
  type ExpectedIndex
} from "./types.ts";

export function expectedIndex(
  scan: DecisionScan,
  currentPaths: ReadonlySet<string> = scan.currentPaths
): ExpectedIndex {
  const errors: string[] = [];
  const recordByPath = new Map(scan.records.map((record) => [record.relativePath, record]));
  const records: DecisionRecord[] = [];

  for (const currentPath of currentPaths) {
    const record = recordByPath.get(currentPath);
    if (!record) {
      errors.push(scan.indexRelativePath + " references missing decision " + currentPath);
      continue;
    }
    records.push(record);
  }

  if (errors.length > 0) {
    return { errors, text: null };
  }

  records.sort(compareDecisionRecords);
  const index: DecisionIndex = {
    schemaVersion: 1,
    current: records.map((record) => ({
      path: record.relativePath,
      title: record.title,
      background: record.background,
      decision: record.decision
    }))
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
    archivedCount: scan.records.filter((record) => record.archived).length,
    areaCount: scan.areaIds.size,
    currentCount: scan.records.filter((record) => record.current).length,
    decisionCount: scan.records.length,
    errors,
    scan
  };
}
