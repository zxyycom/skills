import { deflateSync } from "node:zlib";
import { fs, path, runGit } from "../protocol/version-control-test-support.ts";

export const selected = "docs/tracked.md";
export const unselected = "docs/staged.bin";
export const options = {
  pathScope: "docs",
  contentPaths: [selected],
  payloadScope: "content-paths"
} as const;

export function objectPath(root: string, file: string): string {
  const oid = runGit(root, ["rev-parse", `:${file}`]).trim();
  return path.join(root, ".git/objects", oid.slice(0, 2), oid.slice(2));
}

/** Keep an object's identity but replace its valid blob framing and actual bytes. */
export async function overwriteBlobPayload(target: string): Promise<void> {
  const bytes = Buffer.from("changed actual payload\n");
  await fs.chmod(target, 0o600);
  await fs.writeFile(
    target,
    deflateSync(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
  );
}
