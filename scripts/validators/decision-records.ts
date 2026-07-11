import path from "node:path";
import { pathToFileURL } from "node:url";
import { rootDir } from "../lib/project.ts";

export type DecisionValidationResult = {
  areaCount: number;
  decisionCount: number;
  errors: string[];
};

type PortableValidationResult = {
  areaCount: number;
  decisionCount: number;
  errors: string[];
};

type DecisionRecordsModule = {
  validateDecisionRecords: (options: {
    workspaceRoot: string;
  }) => Promise<PortableValidationResult>;
};

async function loadDecisionRecordsModule(): Promise<DecisionRecordsModule> {
  const modulePath = path.join(
    rootDir,
    "skills",
    "decision-records",
    "scripts",
    "decision-records.mjs"
  );
  return await import(pathToFileURL(modulePath).href) as DecisionRecordsModule;
}

export async function validateDecisionRecords(
  workspaceRoot: string = rootDir
): Promise<DecisionValidationResult> {
  const decisionRecords = await loadDecisionRecordsModule();
  const result = await decisionRecords.validateDecisionRecords({ workspaceRoot });

  return {
    areaCount: result.areaCount,
    decisionCount: result.decisionCount,
    errors: result.errors
  };
}
