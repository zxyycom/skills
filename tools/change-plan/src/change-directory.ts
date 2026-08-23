import path from "node:path";
import type { ChangePlanStatus } from "./types.ts";

export function changePlanStatusFromDirectory(
  changeDirectory: string
): ChangePlanStatus {
  return path.basename(path.dirname(path.resolve(changeDirectory))) ===
    "archive"
    ? "archived"
    : "active";
}
