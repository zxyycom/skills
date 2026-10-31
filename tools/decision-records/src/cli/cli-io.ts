import process from "node:process";

export type DecisionRecordsCliIo = {
  stderr: (text: string) => void;
  stdout: (text: string) => void;
};

export const processDecisionRecordsCliIo: DecisionRecordsCliIo = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text)
};
