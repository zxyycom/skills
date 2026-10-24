import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

/** 两域公开 selected 入口使用相同来源安全探针，领域结果由调用者解释。 */
export async function assertSelectedSourceSafety(
  options: Readonly<{
    root: string;
    source: string;
    index: string;
    fault: "symlink" | "utf8" | "mode";
    synchronize: () => Promise<
      Readonly<{ rejected: boolean; details: unknown }>
    >;
  }>
): Promise<void> {
  const { source, index, fault } = options;
  const before = await fs.readFile(index);
  if (fault === "symlink") {
    const external = path.join(options.root, "outside.md");
    await fs.copyFile(source, external);
    await fs.rm(source);
    await fs.symlink(external, source);
  } else if (fault === "utf8")
    await fs.writeFile(source, Buffer.from([0xc3, 0x28]));
  const originalOpen = fs.open;
  let reads = 0;
  if (fault === "mode") {
    await fs.chmod(source, 0o640);
    fs.open = (async (...args) => {
      if (args[0] === source && ++reads === 2) await fs.chmod(source, 0o600);
      return originalOpen(...args);
    }) as typeof fs.open;
  }
  let result;
  try {
    result = await options.synchronize();
  } finally {
    fs.open = originalOpen;
  }
  assert.equal(result.rejected, true, JSON.stringify(result.details));
  assert.deepEqual(await fs.readFile(index), before);
  if (fault === "mode")
    assert.equal((await fs.stat(source)).mode & 0o7777, 0o600);
}
