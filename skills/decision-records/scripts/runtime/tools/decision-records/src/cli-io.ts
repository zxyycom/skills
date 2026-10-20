/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli-io.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli-io.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli-io.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import process from "node:process";

export type DecisionRecordsCliIo = {
  stderr: (text: string) => void;
  stdout: (text: string) => void;
};

export const processDecisionRecordsCliIo: DecisionRecordsCliIo = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text)
};
