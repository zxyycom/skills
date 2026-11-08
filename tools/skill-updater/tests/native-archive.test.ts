import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, strToU8 } from "fflate";
import { extractNativeArchive } from "../src/native/archive.ts";

function central(data: Buffer): number {
  return data.readUInt32LE(data.length - 22 + 16);
}

test("native archives reject unsafe members before extraction", () => {
  const zip = (files: Record<string, Uint8Array>) =>
    Buffer.from(zipSync(files));
  const good = zip({
    "role/SKILL.md": strToU8("content"),
    "role/文档.txt": strToU8("text")
  });
  assert.deepEqual(
    [...extractNativeArchive(good).keys()],
    ["role/SKILL.md", "role/文档.txt"]
  );
  assert.throws(() => extractNativeArchive(zip({ "../escape": strToU8("x") })));
  assert.throws(() =>
    extractNativeArchive(
      zip({ "role/A": strToU8("x"), "role/a": strToU8("y") })
    )
  );
  assert.throws(() =>
    extractNativeArchive(zip({ role: strToU8("x"), "role/a": strToU8("y") }))
  );
  const symlink = zip({ "role/link": strToU8("target") });
  const directory = central(symlink);
  symlink.writeUInt16LE(0x0314, directory + 4);
  symlink.writeUInt32LE(0xa1ff0000, directory + 38);
  assert.throws(() => extractNativeArchive(symlink), /file type/);
  const inconsistent = zip({ "role/a": strToU8("x") });
  inconsistent[30] = "X".charCodeAt(0);
  assert.throws(() => extractNativeArchive(inconsistent), /disagree/);
  const understated = zip({
    "role/payload": new Uint8Array(1024 * 1024).fill(65)
  });
  understated.writeUInt32LE(1, 22);
  understated.writeUInt32LE(1, central(understated) + 24);
  assert.throws(
    () => extractNativeArchive(understated),
    /exceeds declared size/
  );
  const tooLarge = zip({ "role/a": strToU8("x") });
  tooLarge.writeUInt32LE(128 * 1024 * 1024 + 1, central(tooLarge) + 24);
  assert.throws(() => extractNativeArchive(tooLarge), /exceeds limit/);
});
