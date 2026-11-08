import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyLegacyInstallation } from "../src/native/legacy-preflight.ts";

test("legacy preflight detects missing and customized files without changing the target", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "legacy-preflight-"));
  try {
    const expected = {
      byteLength: 3,
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    };
    await fs.mkdir(path.join(root, "scripts"));
    await fs.writeFile(path.join(root, "scripts", "entry.ts"), "abc");
    await fs.writeFile(path.join(root, "sentinel"), "keep");
    const files = { "scripts/entry.ts": expected };
    assert.deepEqual(await verifyLegacyInstallation(root, files), []);
    await fs.writeFile(path.join(root, "scripts", "entry.ts"), "abd");
    assert.deepEqual(await verifyLegacyInstallation(root, files), [
      "scripts/entry.ts"
    ]);
    await fs.unlink(path.join(root, "scripts", "entry.ts"));
    assert.deepEqual(await verifyLegacyInstallation(root, files), [
      "scripts/entry.ts"
    ]);
    await assert.rejects(
      verifyLegacyInstallation(root, { "../escape": expected })
    );
    await assert.rejects(
      verifyLegacyInstallation(root, { "CON.txt": expected })
    );
    await assert.rejects(
      verifyLegacyInstallation(root, {
        "scripts/A": expected,
        "scripts/a": expected
      })
    );
    await assert.rejects(
      verifyLegacyInstallation(root, {
        "scripts/a": expected,
        "Scripts/b": expected
      })
    );
    await assert.rejects(
      verifyLegacyInstallation(root, {
        scripts: expected,
        "scripts/a": expected
      })
    );
    if (process.platform !== "win32") {
      await fs.symlink("../sentinel", path.join(root, "scripts", "entry.ts"));
      assert.deepEqual(await verifyLegacyInstallation(root, files), [
        "scripts/entry.ts"
      ]);
    }
    assert.equal(
      await fs.readFile(path.join(root, "sentinel"), "utf8"),
      "keep"
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
