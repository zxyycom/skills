import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { lockfileFingerprint } from "./environment-lockfile.js";

test("lockfile fingerprints ignore line-ending differences", async () => {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "environment-lockfile-test-")
  );
  try {
    const lfPath = path.join(tempRoot, "lf.yaml");
    const crlfPath = path.join(tempRoot, "crlf.yaml");
    const changedPath = path.join(tempRoot, "changed.yaml");
    await Promise.all([
      writeFile(lfPath, "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n"),
      writeFile(
        crlfPath,
        "lockfileVersion: '9.0'\r\nsettings:\r\n  autoInstallPeers: true\r\n"
      ),
      writeFile(
        changedPath,
        "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: false\n"
      )
    ]);

    assert.equal(
      lockfileFingerprint(lfPath),
      lockfileFingerprint(crlfPath)
    );
    assert.notEqual(
      lockfileFingerprint(lfPath),
      lockfileFingerprint(changedPath)
    );
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
});
