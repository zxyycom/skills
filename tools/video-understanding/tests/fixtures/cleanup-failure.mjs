import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { complete } from "./evidence-state.ts";
import { failure, VideoFailure } from "../../src/failure.ts";
import { publishEvidence, withWriter } from "../../src/store/store.ts";

// Faults live only in this isolated child process, not in a production injection API.
const [directory, mode] = process.argv.slice(2);
const index = await complete(directory);
const target = path.join(directory, "evidence.json");
const before = await fs.promises.readFile(target, "utf8");
const originalRm = fs.promises.rm;
const originalOpen = fs.promises.open;
let removeAttempted = false;
let closeAttempted = false;
const fault = () =>
  Object.assign(new Error("unsafe cleanup exception detail"), {
    code: "EPERM"
  });

fs.promises.rm = async (file, options) => {
  if (mode.startsWith("publish") && path.basename(file).startsWith(".index-"))
    throw fault();
  if (path.basename(file) === ".write-lock") {
    removeAttempted = true;
    if (!mode.includes("close")) throw fault();
  }
  return originalRm(file, options);
};
fs.promises.open = async (...args) => {
  const handle = await originalOpen(...args);
  if (mode.includes("close") && path.basename(args[0]) === ".write-lock") {
    const close = handle.close.bind(handle);
    handle.close = async () => {
      closeAttempted = true;
      await close();
      throw fault();
    };
  }
  return handle;
};
syncBuiltinESMExports();

let caught;
const primary = failure({
  kind: "input",
  stage: "frames",
  target: "fixture input",
  reason: "primary fixture failure"
});
try {
  const changed = {
    ...index,
    frames: { ...index.frames, attempt: { status: "complete" } }
  };
  if (mode.startsWith("publish")) {
    await publishEvidence(
      directory,
      mode.includes("primary") ? { ...changed, version: 2 } : changed
    );
  } else {
    await withWriter({
      output: directory,
      work: async () => {
        if (mode.includes("primary")) throw primary;
        await publishEvidence(directory, changed);
      }
    });
  }
} catch (error) {
  if (!(error instanceof VideoFailure)) throw error;
  caught = {
    failure: error.failure,
    primaryIdentityPreserved: error === primary
  };
} finally {
  fs.promises.rm = originalRm;
  fs.promises.open = originalOpen;
  syncBuiltinESMExports();
}
const after = await fs.promises.readFile(target, "utf8");
console.log(
  JSON.stringify({
    ...caught,
    unchanged: before === after,
    frameStatus: JSON.parse(after).frames.attempt.status,
    removeAttempted,
    closeAttempted
  })
);
