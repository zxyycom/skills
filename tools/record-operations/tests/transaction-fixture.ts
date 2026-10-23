import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RecordTransactionPlan } from "../src/transaction.ts";
import {
  readRecordFileSnapshot,
  type RecordFileWrite
} from "../src/transaction-files.ts";

type Fixture = Readonly<{
  root: string;
  a: string;
  b: string;
  index: string;
  plan: RecordTransactionPlan<null>;
}>;

export async function fixture(
  run: (fixture: Fixture) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "record-transaction-contract-")
  );
  try {
    const a = path.join(root, "a.md"),
      b = path.join(root, "b.md"),
      index = path.join(root, "index.json");
    await fs.writeFile(a, "old-a", { mode: 0o640 });
    await fs.writeFile(b, "old-b", { mode: 0o600 });
    await fs.writeFile(index, "old-index", { mode: 0o640 });
    const write = async (
      target: string,
      text: string
    ): Promise<RecordFileWrite> => ({
      path: target,
      before: await readRecordFileSnapshot(root, target),
      next: Buffer.from(text)
    });
    const plan = {
      value: null,
      root,
      writes: [await write(a, "new-a"), await write(b, "new-b")],
      index: await write(index, "new-index")
    };
    await run({ root, a, b, index, plan });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

export const stages = {
  fresh: async () => {},
  verify: async () => {},
  verifyRecovered: async () => {}
};
