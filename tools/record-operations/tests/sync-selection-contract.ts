import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as v from "valibot";

type Observation = Readonly<{ ok: boolean; details: string }>;

/** API/CLI 使用同一严格 baseline 与 selector 时序契约；失败后直接核对持久字节。 */
export async function assertSyncSelectionPriority(
  options: Readonly<{
    indexPath: string;
    knownSelector: string;
    synchronize: (selector: string) => Promise<readonly Observation[]>;
  }>
): Promise<void> {
  const canonical = await fs.readFile(options.indexPath, "utf8");
  const value: unknown = JSON.parse(canonical);
  const index = v.parse(
    v.looseObject({
      entries: v.record(v.string(), v.looseObject({ name: v.string() }))
    }),
    value
  );
  const noncanonical = JSON.stringify(index);
  await fs.writeFile(options.indexPath, noncanonical);
  for (const result of await options.synchronize("absent")) {
    assert.equal(result.ok, false);
    assert.match(result.details, /selector-not-found/);
    assert.doesNotMatch(
      result.details,
      /selected sync requires a valid baseline/
    );
  }
  for (const result of await options.synchronize(options.knownSelector)) {
    assert.equal(result.ok, false);
    assert.match(result.details, /canonical persisted index/);
  }
  assert.equal(await fs.readFile(options.indexPath, "utf8"), noncanonical);
  const firstId = Object.keys(index.entries)[0];
  assert.notEqual(firstId, undefined, "fixture must include a published entry");
  const invalidField = {
    ...index,
    entries: {
      ...index.entries,
      [firstId!]: { ...index.entries[firstId!]!, name: null }
    }
  };
  for (const invalid of ["{invalid", JSON.stringify(invalidField)]) {
    await fs.writeFile(options.indexPath, invalid);
    for (const result of await options.synchronize("absent")) {
      assert.equal(result.ok, false);
      assert.match(result.details, /selected sync requires a valid baseline/);
      assert.doesNotMatch(result.details, /selector-not-found/);
    }
    assert.equal(await fs.readFile(options.indexPath, "utf8"), invalid);
  }
  await fs.writeFile(options.indexPath, canonical);
  const originalOpen = fs.open;
  let attempts = 0;
  fs.open = (async (...args: Parameters<typeof fs.open>) => {
    if (args[0] === options.indexPath) {
      attempts += 1;
      throw Object.assign(new Error("synthetic baseline access denial"), {
        code: "EACCES"
      });
    }
    return await originalOpen(...args);
  }) as typeof fs.open;
  try {
    const results = await options.synchronize("absent");
    for (const result of results) {
      assert.equal(result.ok, false);
      assert.match(result.details, /access-denied/);
      assert.doesNotMatch(result.details, /selector-not-found/);
    }
    assert.equal(
      attempts,
      results.length,
      "a strict baseline read failure must not be silently retried"
    );
  } finally {
    fs.open = originalOpen;
  }
}
