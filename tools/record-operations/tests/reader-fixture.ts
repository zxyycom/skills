import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordReaderWorkerThreshold } from "../src/reader-batch.ts";

export const repository = fileURLToPath(new URL("../../../", import.meta.url));

export async function fixture(run: (root: string) => Promise<void>) {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "record-reader-test-")
  );
  try {
    const root = await fs.realpath(temporary);
    await fs.mkdir(path.join(root, "archive"));
    await fs.writeFile(path.join(root, "a.md"), "\ufeffalpha 中文\n");
    await fs.writeFile(path.join(root, "archive/b.md"), "beta\r\n");
    await run(root);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

export function many(paths: readonly string[]): string[] {
  return Array.from(
    { length: recordReaderWorkerThreshold },
    (_, index) => paths[index % paths.length]!
  );
}
