import assert from "node:assert/strict";
import test from "node:test";
import { commandText } from "./lib/vibe-gate.ts";

test("direct rerun formatting preserves argv boundaries", () => {
  assert.equal(
    commandText({ command: "bun", args: ["test", "a file's.ts"] }),
    `bun test 'a file'"'"'s.ts'`
  );
});
