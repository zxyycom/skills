import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

export type RecordQueryObservation = Readonly<{ ok: boolean; body?: string }>;
export type RecordDiscoveryAdapter = Readonly<{
  root: string;
  collection: string;
  sourcePath: string;
  poisonPublishedGraph: () => Promise<void>;
  query: (
    command: "list" | "metadata" | "content" | "show" | "related" | "trace"
  ) => Promise<RecordQueryObservation>;
  showCli: () => Promise<RecordQueryObservation>;
  queryLocation: (
    root: string,
    collection: string
  ) => Promise<RecordQueryObservation>;
}>;

/** 同一产品契约由两个领域适配器执行，独立后验不调用被测解析器。 */
export async function assertDiscoveryDependencyContract(
  adapter: RecordDiscoveryAdapter
): Promise<void> {
  await adapter.poisonPublishedGraph();
  for (const command of ["list", "metadata", "show", "content"] as const)
    assert.equal(
      (await adapter.query(command)).ok,
      true,
      `${command} must not audit an unrelated bad domain graph`
    );
  for (const command of ["related", "trace"] as const)
    assert.equal(
      (await adapter.query(command)).ok,
      false,
      `${command} requires the complete domain graph`
    );
  const source = path.join(
    adapter.root,
    adapter.collection,
    adapter.sourcePath
  );
  const original = await fs.readFile(source);
  const large = Buffer.concat([
    original,
    Buffer.from(`\n${"large-body ".repeat(220_000)}\n`)
  ]);
  await fs.writeFile(source, large);
  const shown = await adapter.query("show");
  assert.equal(shown.ok, true);
  assert.equal(shown.body, large.toString("utf8"));
  const cliShown = await adapter.showCli();
  assert.equal(cliShown.ok, true);
  assert.equal(
    cliShown.body?.includes(large.toString("utf8")),
    true,
    "CLI show returns the complete body beyond search budget"
  );
  const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), original]);
  await fs.writeFile(source, withBom);
  assert.equal(
    (await adapter.query("show")).body,
    withBom.toString("utf8"),
    "complete show preserves a UTF-8 BOM as source text"
  );
  await fs.writeFile(source, Buffer.concat([original, Buffer.from([0xff])]));
  assert.equal(
    (await adapter.query("show")).ok,
    false,
    "invalid UTF-8 must fail closed"
  );
  assert.equal(
    (await adapter.showCli()).ok,
    false,
    "CLI maps invalid UTF-8 to nonzero failure"
  );
  await fs.unlink(source);
  const replacement = path.join(adapter.root, "outside-source.md");
  await fs.writeFile(replacement, original);
  await fs.symlink(replacement, source);
  assert.equal(
    (await adapter.query("show")).ok,
    false,
    "a source symlink must not be followed"
  );
  await fs.unlink(source);
  await fs.writeFile(source, original);
  const originalOpen = fs.open;
  const moved = `${source}.displaced`;
  let replaced = false;
  fs.open = async (...args) => {
    const handle = await originalOpen(...args);
    if (String(args[0]) === source && !replaced) {
      replaced = true;
      await fs.rename(source, moved);
      await fs.writeFile(source, original);
    }
    return handle;
  };
  try {
    assert.equal(
      (await adapter.query("show")).ok,
      false,
      "same-ID path replacement during a handle read must fail"
    );
    assert.equal(replaced, true);
  } finally {
    fs.open = originalOpen;
    await fs.rm(moved, { force: true });
  }
  const collection = path.join(adapter.root, adapter.collection);
  const movedCollection = `${collection}.displaced`;
  let replacedParent = false;
  fs.open = async (...args) => {
    const handle = await originalOpen(...args);
    if (String(args[0]) === source && !replacedParent) {
      replacedParent = true;
      await fs.rename(collection, movedCollection);
      await fs.mkdir(collection);
      await fs.link(path.join(movedCollection, adapter.sourcePath), source);
    }
    return handle;
  };
  try {
    assert.equal(
      (await adapter.query("show")).ok,
      false,
      "parent inode replacement fails even when a hard link preserves source bytes and inode"
    );
    assert.equal(replacedParent, true);
  } finally {
    fs.open = originalOpen;
    if (replacedParent) {
      await fs.unlink(source);
      await fs.rmdir(collection);
      await fs.rename(movedCollection, collection);
    }
  }
  const outside = path.join(adapter.root, "outside-workspace");
  await fs.mkdir(outside);
  const collectionLink = path.join(outside, "collection");
  await fs.symlink(path.join(adapter.root, adapter.collection), collectionLink);
  assert.equal(
    (await adapter.queryLocation(outside, "collection")).ok,
    false,
    "canonical collection cannot escape its workspace"
  );
  assert.equal(
    (await adapter.queryLocation(outside, "../" + adapter.collection)).ok,
    false
  );
}
