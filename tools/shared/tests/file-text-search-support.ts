import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import type {
  FileTextSearchMode,
  FileTextSearchSelection
} from "../src/file-text-search/index.ts";

const temporaryDirectories: string[] = [];

after(async () => {
  await Promise.all(
    temporaryDirectories.map(async (directory) => {
      await fs.rm(directory, { force: true, recursive: true });
    })
  );
});

export async function withFixture(
  files: Readonly<Record<string, string | Uint8Array>>,
  callback: (root: string) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "file-text-search-"));
  temporaryDirectories.push(root);
  for (const [sourcePath, content] of Object.entries(files)) {
    const target = path.join(root, ...sourcePath.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
  await callback(root);
}

export function request(
  root: string,
  selection: FileTextSearchSelection,
  text: string,
  mode: FileTextSearchMode = "all"
) {
  return {
    preview: {
      contextLines: 1,
      maxFiles: 20,
      maxMatchesPerFile: 20,
      maxPreviewCharacters: 10_000
    },
    query: { mode, text },
    root,
    selection
  } as const;
}
