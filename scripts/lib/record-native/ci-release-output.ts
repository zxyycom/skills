import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function createReusedReleaseDirectory(
  root: string
): Promise<string> {
  const dist = path.join(root, "dist");
  await mkdir(dist, { recursive: true });
  const output = path.join(dist, "record-cli-reused-release");
  await mkdir(output);
  return output;
}
