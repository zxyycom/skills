import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { resolveIndexPath } from "../src/index-path.ts";
import {
  readIndexSourceAtResolvedPath,
  readIndexTextAtResolvedPath
} from "../src/storage-load.ts";
import { withTempRoot } from "./staging-fixture.ts";
import { resultValue } from "./support.ts";

test("internal index source acquisition retains actual BOM bytes while ordinary text decoding is unchanged", async () => {
  await withTempRoot(async (root) => {
    const text = '{"hello":"世界"}';
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(text)
    ]);
    await fs.writeFile(path.join(root, "index.json"), bytes);
    const options = {
      indexPath: "index.json",
      resolved: resultValue(await resolveIndexPath("index.json", root))
    };
    const source = resultValue(await readIndexSourceAtResolvedPath(options));
    assert.deepEqual(source.bytes, bytes);
    assert.equal(source.text, text);
    assert.equal(resultValue(await readIndexTextAtResolvedPath(options)), text);
  });
});

for (const failure of ["missing", "invalid-utf8"]) {
  test(`internal raw and ordinary text index readers preserve ${failure} diagnostics`, async () => {
    await withTempRoot(async (root) => {
      if (failure === "invalid-utf8")
        await fs.writeFile(path.join(root, "index.json"), Buffer.from([0xff]));
      const options = {
        indexPath: "index.json",
        resolved: resultValue(await resolveIndexPath("index.json", root))
      };
      const raw = await readIndexSourceAtResolvedPath(options);
      const text = await readIndexTextAtResolvedPath(options);
      assert.equal(raw.status, "error");
      assert.deepEqual(raw, text);
      assert.equal(
        raw.diagnostics[0]?.code,
        failure === "missing"
          ? "state-index.index-missing"
          : "state-index.index-encoding-invalid"
      );
    });
  });
}
