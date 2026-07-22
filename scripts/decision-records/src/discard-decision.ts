import fs from "node:fs/promises";
import path from "node:path";
import {
  type DecisionRecord,
  type DecisionScan
} from "./types.ts";

export type DiscardDecisionOptions = {
  indexText: string;
  record: DecisionRecord;
  scan: DecisionScan;
  validate: () => Promise<string[]>;
};

export async function discardDecision(
  options: DiscardDecisionOptions
): Promise<string[]> {
  const { indexText, record, scan, validate } = options;
  let body: string;
  try {
    body = await fs.readFile(record.decisionPath, "utf8");
  } catch (error) {
    return [
      "Failed to read decision body "
      + record.relativePath
      + ": "
      + errorText(error)
    ];
  }

  try {
    await fs.rm(record.decisionPath);
    const areaDirectory = path.dirname(record.decisionPath);
    if ((await fs.readdir(areaDirectory)).length === 0) {
      await fs.rmdir(areaDirectory);
    }
    await fs.writeFile(scan.indexPath, indexText, "utf8");
  } catch (error) {
    return [
      "Failed to discard "
      + record.relativePath
      + ": "
      + errorText(error),
      ...await restoreDiscardedDecision(scan, record, body)
    ];
  }

  let validationErrors: string[];
  try {
    validationErrors = await validate();
  } catch (error) {
    validationErrors = [
      "Failed to validate discarded decision "
      + record.relativePath
      + ": "
      + errorText(error)
    ];
  }
  if (validationErrors.length === 0) {
    return [];
  }
  return [
    ...validationErrors,
    ...await restoreDiscardedDecision(scan, record, body)
  ];
}

async function restoreDiscardedDecision(
  scan: DecisionScan,
  record: DecisionRecord,
  body: string
): Promise<string[]> {
  const errors: string[] = [];
  try {
    await fs.mkdir(path.dirname(record.decisionPath), { recursive: true });
    await fs.writeFile(record.decisionPath, body, "utf8");
  } catch (error) {
    errors.push(
      "Failed to restore decision body "
      + record.relativePath
      + ": "
      + errorText(error)
    );
  }
  try {
    await fs.writeFile(scan.indexPath, scan.indexText, "utf8");
  } catch (error) {
    errors.push(
      "Failed to restore decision index "
      + scan.indexRelativePath
      + ": "
      + errorText(error)
    );
  }
  return errors;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
