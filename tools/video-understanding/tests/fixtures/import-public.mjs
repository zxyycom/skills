import assert from "node:assert/strict";
import childProcess from "node:child_process";
import net from "node:net";
import { syncBuiltinESMExports } from "node:module";
import { pathToFileURL } from "node:url";

// Imports may read modules; command execution, output, network and process status are forbidden.
let effects = 0;
const forbidden = () => {
  effects++;
  throw new Error("unexpected import side effect");
};
const log = console.log;
const error = console.error;
const fetch = globalThis.fetch;
const spawn = childProcess.spawn;
const connect = net.Socket.prototype.connect;
console.log = forbidden;
console.error = forbidden;
globalThis.fetch = forbidden;
childProcess.spawn = forbidden;
net.Socket.prototype.connect = forbidden;
syncBuiltinESMExports();
process.exitCode = 23;
try {
  const api = await import(pathToFileURL(process.argv[2]).href);
  assert.deepEqual(Object.keys(api).sort(), ["VideoFailure", "runVideoCli"]);
  assert.equal(typeof api.runVideoCli, "function");
  assert.equal(
    new api.VideoFailure({
      kind: "environment",
      stage: "runtime",
      target: "fixture",
      reason: "fixture",
      action: "fixture"
    }) instanceof Error,
    true
  );
  assert.equal(effects, 0);
  assert.equal(process.exitCode, 23);
} finally {
  console.log = log;
  console.error = error;
  globalThis.fetch = fetch;
  childProcess.spawn = spawn;
  net.Socket.prototype.connect = connect;
  syncBuiltinESMExports();
  process.exitCode = 0;
}
