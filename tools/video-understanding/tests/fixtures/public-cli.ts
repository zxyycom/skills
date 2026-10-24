import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { resourcesFromEntry } from "../../src/resources.ts";
import { runProcess } from "./process.ts";

export const root = path.resolve(import.meta.dirname, "../../../..");
export const cli = path.join(import.meta.dirname, "source-cli.ts");
export const resources = resourcesFromEntry(
  new URL("../../resources/scripts/video.ts", import.meta.url)
);

export async function workspace(
  work: (directory: string) => Promise<void>
): Promise<void> {
  const base = path.join(root, ".log/video-tests");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, "evidence 'quoted' "));
  try {
    await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function publicJson(
  directory: string | undefined,
  command: string,
  args: string[] = [],
  entry = cli
) {
  const selector = directory === undefined ? [] : ["--output", directory];
  const result = await runProcess(
    "node",
    [entry, command, ...selector, "--format", "json", ...args],
    { reject: false }
  );
  return { ...result, value: result.stdout ? JSON.parse(result.stdout) : null };
}
