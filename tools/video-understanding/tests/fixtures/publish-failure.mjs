import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

// Loaded only in an isolated CLI child. The real index and immutable artifacts remain untouched.
const rename = fs.promises.rename;
fs.promises.rename = async (source, target) => {
  if (path.basename(target) === "evidence.json") {
    throw Object.assign(new Error("unsafe publication exception detail"), {
      code: "EPERM"
    });
  }
  return rename(source, target);
};
syncBuiltinESMExports();
