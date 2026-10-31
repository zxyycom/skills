import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { prepareInvestigationResourceRoot } from "../../../src/resources/resource-root.ts";
import { inspectOwnedInvestigationResources } from "../../../src/resources/resource-file-validation.ts";
import { investigationRoot } from "../../support/fixture-support.ts";

/** Exercise the production FS validators using explicit, already acquired membership facts. */
export async function readOwnedResourceFixture(
  root: string,
  resource: string | null
): Promise<string | null> {
  const relative = resource?.replace("docs/investigations/_resources/", "");
  const prepared = await prepareInvestigationResourceRoot(
    investigationRoot(root),
    {
      mode: "version-control",
      files: new Set(relative === undefined ? [] : [relative])
    }
  );
  if (prepared.status === "invalid")
    throw prepared.failure ?? new Error(prepared.errors.join("; "));
  if (prepared.status === "missing") return null;
  const inspected = await inspectOwnedInvestigationResources(
    prepared,
    ["one"],
    relative === undefined ? [] : [relative]
  );
  if (inspected.failure !== undefined) throw inspected.failure;
  if (inspected.errors.length > 0) throw new Error(inspected.errors.join("; "));
  await prepared.directories.assertCurrent();
  if (resource === null) return null;
  return await fs
    .readFile(path.join(root, resource), "utf8")
    .catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw error;
    });
}

/** A replacement must fail in the real FS validator before source-byte acquisition. */
export async function expectResourceRejectionBeforeBytes(
  root: string,
  resource: string,
  replacementOccurred: () => boolean
): Promise<void> {
  const original = fs.readFile;
  let reads = 0;
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    if (args[0] === path.join(root, resource)) reads += 1;
    return await original(...args);
  }) as typeof fs.readFile;
  try {
    await assert.rejects(readOwnedResourceFixture(root, resource));
    assert.equal(replacementOccurred(), true);
    assert.equal(reads, 0);
  } finally {
    fs.readFile = original;
  }
}

export const resourceFailureId = "one/nested/member.txt";

export function targetFor(root: string, failure: string): string {
  const resources = path.join(investigationRoot(root), "_resources");
  if (failure.startsWith("root")) return resources;
  if (failure.startsWith("owner")) return path.join(resources, "one");
  if (failure.startsWith("intermediate"))
    return path.join(resources, "one/nested");
  return path.join(resources, resourceFailureId);
}
export function operationFor(failure: string): string {
  if (failure.endsWith("enumeration")) return "read resource directory";
  if (failure.endsWith("resolution")) return "resolve resource root";
  if (failure === "terminal open") return "open resource file";
  return "inspect resource path";
}

/**
 * A full stage starts at zero and arms the fault after its first report read.
 * An isolated FS validation starts at one because its first phase already ran.
 */
export function injectSecondPhaseFailure(
  root: string,
  failure: string,
  error: Error,
  initialSourceReads: 0 | 1
): Readonly<{
  injected: () => boolean;
  restore: () => void;
}> {
  const target = targetFor(root, failure);
  const source = path.join(investigationRoot(root), "one.md");
  const readFile = fs.readFile;
  let sourceReads = initialSourceReads,
    injected = false;
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const result = await readFile(...args);
    if (args[0] === source) sourceReads += 1;
    return result;
  }) as typeof fs.readFile;
  const fail = (candidate: unknown): void => {
    if (candidate === target && sourceReads === 1 && !injected) {
      injected = true;
      throw error;
    }
  };
  let restoreOperation: () => void;
  if (failure.endsWith("enumeration")) {
    const original = fs.readdir;
    fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.readdir;
    restoreOperation = () => {
      fs.readdir = original;
    };
  } else if (failure.endsWith("resolution")) {
    const original = fs.realpath;
    fs.realpath = (async (...args: Parameters<typeof fs.realpath>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.realpath;
    restoreOperation = () => {
      fs.realpath = original;
    };
  } else if (failure === "terminal open") {
    const original = fs.open;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.open;
    restoreOperation = () => {
      fs.open = original;
    };
  } else {
    const original = fs.lstat;
    fs.lstat = (async (...args: Parameters<typeof fs.lstat>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.lstat;
    restoreOperation = () => {
      fs.lstat = original;
    };
  }
  return {
    injected: () => injected,
    restore: () => {
      fs.readFile = readFile;
      restoreOperation();
    }
  };
}
