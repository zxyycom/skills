import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { applyDecisionChanges } from "../../../src/transactions/decision-transaction.ts";
import { validateDecisionRecords } from "../../../src/index.ts";
import { scanDecisionRecords } from "../../../src/scan/scan.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  withFixtureWorkspace
} from "../../support/support.ts";

export {
  applyDecisionChanges,
  archivedDecisionId,
  assert,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
  scanDecisionRecords,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
};

/** Observe the real safe file-handle writer rather than a retired path writer. */
export function interceptDecisionWrites(
  beforeWrite: (filePath: string) => Promise<void>
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
  assert.ok(descriptor);
  const open = fs.open.bind(fs);
  Object.defineProperty(fs, "open", {
    ...descriptor,
    value: async (...args: Parameters<typeof fs.open>) => {
      const handle = await open(...args);
      const flags = args[1];
      if (typeof flags === "number" && (flags & 3) !== 0) {
        const write = handle.writeFile.bind(handle);
        handle.writeFile = async (
          ...writeArgs: Parameters<typeof handle.writeFile>
        ) => {
          await beforeWrite(String(args[0]));
          return await write(...writeArgs);
        };
      }
      return handle;
    }
  });
  return () => {
    Object.defineProperty(fs, "open", descriptor);
  };
}
