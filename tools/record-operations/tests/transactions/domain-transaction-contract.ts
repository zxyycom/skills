import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type DomainTransactionProbe = Readonly<{
  sourcePath: string;
  indexPath: string;
  apply: () => Promise<
    Readonly<{
      failed: boolean;
      changed: boolean;
      outcome: string | undefined;
      review: unknown;
    }>
  >;
}>;

/** The same observable contract is exercised through the actual two domain adapters. */
export async function assertDomainPublishedWriterRejection(
  prepare: (root: string) => Promise<DomainTransactionProbe>
): Promise<void> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "record-domain-contract-")
  );
  try {
    const probe = await prepare(root);
    await fs.chmod(probe.sourcePath, 0o640);
    const beforeSource = await fs.readFile(probe.sourcePath);
    const beforeIndex = await fs.readFile(probe.indexPath);
    const rename = fs.rename;
    fs.rename = async (from, to) => {
      await rename(from, to);
      if (String(to) === probe.indexPath)
        throw new Error(
          "domain index writer rejected after actual publication"
        );
    };
    try {
      const result = await probe.apply();
      assert.equal(result.failed, true);
      assert.equal(result.changed, true);
      assert.equal(result.outcome, "partial-or-unknown");
      assert.equal(result.review, undefined);
    } finally {
      fs.rename = rename;
    }
    assert.notDeepEqual(await fs.readFile(probe.sourcePath), beforeSource);
    assert.notDeepEqual(await fs.readFile(probe.indexPath), beforeIndex);
    assert.equal((await fs.stat(probe.sourcePath)).mode & 0o7777, 0o640);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
