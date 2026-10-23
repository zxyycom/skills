import test from "node:test";
import { assertNativeCreationModes } from "../../record-operations/tests/transaction-creation-modes.ts";

test(
  "Decision native creation preserves umask for candidates and first formal indexes",
  { timeout: 30_000 },
  () => {
    assertNativeCreationModes("decision");
  }
);
