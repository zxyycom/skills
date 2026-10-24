import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CreationModeCase = Readonly<{ mask: number; expected: number }>;

/** Each umask belongs to a child process that loads only its domain's probe. */
export function assertNativeCreationModes(
  probe: URL,
  modes: readonly CreationModeCase[]
): void {
  for (const { mask, expected } of modes) {
    const output = execFileSync(
      "node",
      [fileURLToPath(probe), String(mask), String(expected)],
      { encoding: "utf8", timeout: 20_000 }
    );
    assert.match(output, /native creation and first index verified/);
  }
}

/** The domain owns the behavior probe; this driver owns process state and cleanup. */
export async function runNativeCreationModeProbe(
  options: Readonly<{
    prepare: (root: string) => Promise<void>;
    verify: (root: string, expected: number) => Promise<void>;
  }>
): Promise<void> {
  const mask = modeArgument(process.argv[2]);
  const expected = modeArgument(process.argv[3]);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "record-native-modes-"));
  const originalMask = process.umask();
  try {
    await options.prepare(root);
    process.umask(mask);
    await options.verify(root, expected);
    console.log(
      "native creation and first index verified",
      mask.toString(8),
      expected.toString(8)
    );
  } finally {
    process.umask(originalMask);
    await fs.rm(root, { recursive: true, force: true });
  }
}

function modeArgument(value: string | undefined): number {
  const mode = value === undefined ? Number.NaN : Number(value);
  if (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o777)
    throw new Error(
      "Native creation probe expects a decimal permission mode from 0 to 511"
    );
  return mode;
}
