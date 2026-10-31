import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createCliProgram } from "../../../src/cli/arguments/cli-args.ts";
import { runDecisionRecordsCli } from "../../../src/cli.ts";
import {
  archivedRelativePath,
  currentRelativePath
} from "../../support/support.ts";

export type CliExecution = {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
};

export async function runCli(args: readonly string[]): Promise<CliExecution> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runDecisionRecordsCli(args, {
    io: {
      stderr: (text) => stderr.push(text),
      stdout: (text) => stdout.push(text)
    }
  });
  return { exitCode, stderr: stderr.join(""), stdout: stdout.join("") };
}

export {
  archivedRelativePath,
  assert,
  createCliProgram,
  currentRelativePath,
  path,
  runDecisionRecordsCli,
  test
};
