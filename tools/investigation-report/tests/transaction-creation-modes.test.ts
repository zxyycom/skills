import test from "node:test";
import { assertNativeCreationModes } from "../../record-operations/tests/transaction-creation-modes.ts";

test(
  "Investigation native creation preserves private umask permissions for candidates and first indexes",
  { timeout: 30_000 },
  () => {
    assertNativeCreationModes("investigation");
  }
);
