import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { createCliProgram } from "../../src/cli-args.ts";
import { runDecisionRecordsCli } from "../../src/cli.ts";
import {
  archivedRelativePath,
  currentRelativePath,
  generatedCliPath
} from "../support.ts";

export type CliExecution = {
  exitCode: number;
  stderr: string;
  stdout: string;
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

export function runNodeCli(args: readonly string[]) {
  return spawnSync("node", [generatedCliPath, ...args], { encoding: "utf8" });
}

export {
  archivedRelativePath,
  assert,
  createCliProgram,
  currentRelativePath,
  generatedCliPath,
  path,
  runDecisionRecordsCli,
  spawnSync,
  test
};
