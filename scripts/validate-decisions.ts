import path from "node:path";
import { fileURLToPath } from "node:url";
import { rootDir } from "./lib/project.ts";
import { validateDecisionRecords } from "./validators/decision-records.ts";

export { validateDecisionRecords } from "./validators/decision-records.ts";
export type { DecisionValidationResult } from "./validators/decision-records.ts";

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && path.resolve(entryPoint) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const result = await validateDecisionRecords(rootDir);

  if (result.errors.length > 0) {
    console.error("Decision structure validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Decision structure validation passed (${result.areaCount} areas, ${result.decisionCount} decisions).`);
}
