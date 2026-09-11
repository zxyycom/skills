import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createDecisionCandidate } from "../../src/decision-candidate-service.ts";
import type { DecisionId, DecisionTag } from "../../src/types.ts";
import {
  candidateDecisionBody,
  currentDecisionId,
  decisionFilePath,
  fileExists,
  runSourceCli,
  withTemporaryWorkspace,
  withFixtureWorkspace,
  writeDecision
} from "../support.ts";

export const candidateId = "create-decision-scaffold";

export const newCandidateArguments = [
  "new",
  candidateId,
  "--title",
  "创建候选脚手架",
  "--purpose",
  "让候选在正文完成前拥有稳定身份。",
  "--background",
  "维护者需要先固定元数据再继续编辑正文。",
  "--decision",
  "使用明确的机械脚手架分离创建与建立。",
  "--tag",
  "zeta",
  "--tag",
  "decision-records"
] as const;

export {
  assert,
  candidateDecisionBody,
  createDecisionCandidate,
  currentDecisionId,
  decisionFilePath,
  fileExists,
  fs,
  path,
  runSourceCli,
  test,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
};
export type { DecisionId, DecisionTag };
