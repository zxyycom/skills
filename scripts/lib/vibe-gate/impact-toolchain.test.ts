import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { captureCommand } from "./impact-toolchain.ts";

const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/command/", import.meta.url)
);

test("Gate command capture preserves argv through native and Windows batch launchers", async () => {
  const args = ["中文 path with spaces", "literal&value", "literal!value", ""];
  const batch = process.platform === "win32";
  const output = await captureCommand(
    batch ? path.join(fixtureDirectory, "argv.cmd") : process.execPath,
    batch ? args : [path.join(fixtureDirectory, "argv.js"), ...args],
    fixtureDirectory
  );
  assert.deepEqual(JSON.parse(output.toString("utf8")), args);
});

test("Gate command capture diagnoses a missing executable before launch", async () => {
  await assert.rejects(
    captureCommand("skills-missing-command-8fa9f06c", [], fixtureDirectory),
    /skills-missing-command-8fa9f06c was not found on PATH/u
  );
});

test(
  "Gate batch capture rejects expanding or multiline arguments before launch",
  { skip: process.platform !== "win32" },
  async () => {
    for (const argument of ["%PATH%", "line\nbreak", "line\rbreak"]) {
      await assert.rejects(
        captureCommand(
          path.join(fixtureDirectory, "argv.cmd"),
          [argument],
          fixtureDirectory
        ),
        /unsupported Windows command argument/u
      );
    }
  }
);
