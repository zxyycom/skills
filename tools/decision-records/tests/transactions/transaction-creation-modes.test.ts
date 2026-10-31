import test from "node:test";
import { assertNativeCreationModes } from "../../../record-operations/tests/transactions/transaction-creation-modes.ts";

test(
  "Decision native creation preserves umask for candidates and first formal indexes",
  { timeout: 30_000 },
  () => {
    assertNativeCreationModes(
      new URL("./native-creation-mode-probe.ts", import.meta.url),
      [
        { mask: 0o002, expected: 0o664 },
        { mask: 0o022, expected: 0o644 },
        { mask: 0o200, expected: 0o466 }
      ]
    );
  }
);
