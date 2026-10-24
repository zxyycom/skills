import * as fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const promises = require("node:fs/promises");
const rename = fs.rename;
promises.rename = async (from, to) => {
  if (path.basename(path.dirname(String(to))) === "runs") {
    const error = new Error("unsafe run publication exception detail");
    error.code = "EACCES";
    throw error;
  }
  return rename(from, to);
};
syncBuiltinESMExports();
