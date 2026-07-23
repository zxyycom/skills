import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function lockfileFingerprint(filePath) {
  const normalizedLockfile = readFileSync(filePath, "utf8").replace(
    /\r\n?/gu,
    "\n"
  );
  return createHash("sha256").update(normalizedLockfile).digest("hex");
}
