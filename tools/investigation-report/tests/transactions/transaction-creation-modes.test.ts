import test from "node:test";
import { assertNativeCreationModes } from "../../../record-operations/tests/transactions/transaction-creation-modes.ts";

test(
  "Investigation native creation preserves private umask permissions for candidates and first indexes",
  { timeout: 30_000 },
  () => {
    assertNativeCreationModes(
      new URL("./native-creation-mode-probe.ts", import.meta.url),
      [
        { mask: 0o002, expected: 0o600 },
        { mask: 0o022, expected: 0o600 },
        { mask: 0o200, expected: 0o400 }
      ]
    );
  }
);
