import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

const reads = [];
const readFile = fs.promises.readFile;
fs.promises.readFile = async (file, ...args) => {
  if (
    ["runtime.env", "ocr-profiles.json"].includes(path.basename(String(file)))
  ) {
    reads.push(String(file));
    fs.writeFileSync(process.env.VIDEO_TEST_RECEIPT, JSON.stringify({ reads }));
  }
  return readFile(file, ...args);
};
childProcess.spawn = (program, args, options) => {
  fs.writeFileSync(
    process.env.VIDEO_TEST_RECEIPT,
    JSON.stringify({
      reads,
      program,
      args,
      environment: {
        HF_HUB_OFFLINE: options.env.HF_HUB_OFFLINE,
        HF_HUB_DISABLE_IMPLICIT_TOKEN: options.env.HF_HUB_DISABLE_IMPLICIT_TOKEN
      }
    })
  );
  const error = new Error("fixture blocks all native programs");
  error.code = "ENOENT";
  throw error;
};
syncBuiltinESMExports();
