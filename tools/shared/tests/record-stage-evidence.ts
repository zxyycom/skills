import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runGit } from "./git-fixture.ts";

/** Inject a change after an actual workspace-index read, restoring the IO boundary on failure. */
export async function onWorkspaceIndexRead<T>(
  root: string,
  indexPath: string,
  callback: (count: number) => Promise<void>,
  run: () => Promise<T>
): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
  assert.ok(descriptor !== undefined);
  const original = fs.readFile;
  let count = 0;
  Object.defineProperty(fs, "readFile", {
    ...descriptor,
    value: async (...args: readonly unknown[]) => {
      const result: unknown = await Reflect.apply(original, fs, args);
      if (args[0] === path.join(root, indexPath)) {
        count += 1;
        await callback(count);
      }
      return result;
    }
  });
  try {
    return await run();
  } finally {
    Object.defineProperty(fs, "readFile", descriptor);
  }
}

export function pendingObjectPath(root: string, file: string): string {
  const oid = runGit(root, ["rev-parse", `:${file}`]).trim();
  return path.join(root, ".git/objects", oid.slice(0, 2), oid.slice(2));
}

/** Give P a distinct object before corrupting it, so fixed H remains independently readable. */
export async function requiredIndexPayloadFailure<T>(
  root: string,
  indexPath: string,
  phase: string,
  run: () => Promise<T>
): Promise<T> {
  assert.ok(phase === "preparation" || phase === "independent verification");
  const target = path.join(root, indexPath);
  const workspace = await fs.readFile(target);
  await fs.appendFile(target, "\n");
  runGit(root, ["add", indexPath]);
  await fs.writeFile(target, workspace);
  const object = pendingObjectPath(root, indexPath);
  const before = runGit(root, ["ls-files", "--stage"]);
  let removed = false;
  const remove = async () => {
    await fs.unlink(object);
    removed = true;
  };
  if (phase === "preparation") await remove();
  const result = await onWorkspaceIndexRead(
    root,
    indexPath,
    async (count) => {
      if (phase === "independent verification" && count === 2) await remove();
    },
    run
  );
  assert.equal(removed, true);
  assert.equal(runGit(root, ["ls-files", "--stage"]), before);
  return result;
}

async function observeJsonParses<T>(
  run: () => Promise<T>
): Promise<Readonly<{ result: T; parses: ReadonlyMap<string, number> }>> {
  const original = JSON.parse;
  const parses = new Map<string, number>();
  JSON.parse = (
    text: string,
    reviver?: (this: unknown, key: string, value: unknown) => unknown
  ): unknown => {
    parses.set(text, (parses.get(text) ?? 0) + 1);
    return original(text, reviver);
  };
  try {
    return { result: await run(), parses };
  } finally {
    JSON.parse = original;
  }
}

/** Both domains must independently read W twice while parsing identical W once and H/P separately. */
export async function assertFreshIndexParseReuse<T>(
  root: string,
  indexPath: string,
  pendingText: string,
  run: () => Promise<T>
): Promise<T> {
  const workspaceText = await fs.readFile(path.join(root, indexPath), "utf8");
  assert.notEqual(workspaceText, pendingText);
  let reads = 0;
  const observed = await observeJsonParses(() =>
    onWorkspaceIndexRead(
      root,
      indexPath,
      async () => {
        reads += 1;
      },
      run
    )
  );
  assert.equal(reads, 2);
  assert.equal(observed.parses.get(workspaceText), 1);
  assert.equal(observed.parses.get(pendingText), 2);
  return observed.result;
}

/** Equal decoded text cannot replace actual-byte equivalence: adding a BOM requires another parse. */
export async function assertFreshIndexBomReparse<T>(
  root: string,
  indexPath: string,
  run: () => Promise<T>
): Promise<T> {
  const file = path.join(root, indexPath);
  const text = await fs.readFile(file, "utf8");
  let reads = 0;
  const observed = await observeJsonParses(() =>
    onWorkspaceIndexRead(
      root,
      indexPath,
      async (count) => {
        reads += 1;
        if (count === 1)
          await fs.writeFile(
            file,
            Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)])
          );
      },
      run
    )
  );
  assert.equal(reads, 2);
  assert.equal(observed.parses.get(text), 2);
  return observed.result;
}

/** Preserve the fresh parser's failure priority and the concurrent full Git-index identity. */
export async function assertFreshInvalidPendingIndex(
  root: string,
  indexPath: string,
  run: () => Promise<unknown>
): Promise<void> {
  const invalid = path.join(root, "invalid-pending.json");
  await fs.writeFile(invalid, "{ broken JSON");
  const oid = runGit(root, ["hash-object", "-w", invalid]).trim();
  let expected = "";
  const result = await onWorkspaceIndexRead(
    root,
    indexPath,
    async (count) => {
      if (count !== 2) return;
      runGit(root, ["update-index", "--cacheinfo", "100644", oid, indexPath]);
      expected = runGit(root, ["ls-files", "--stage"]);
    },
    run
  );
  assert.ok(
    result !== null && typeof result === "object" && "status" in result
  );
  assert.equal(result.status, "error", JSON.stringify(result));
  assert.match(
    JSON.stringify(result),
    /JSON|Expected|Unexpected|property name/
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /"code":"(?:state-index\.pending-conflict|decision-records\.version-control-pending-conflict)"/
  );
  assert.equal(runGit(root, ["ls-files", "--stage"]), expected);
}
