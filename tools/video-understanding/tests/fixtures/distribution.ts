import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  realpath,
  rm
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { root } from "./public-cli.ts";

export const skill = path.join(root, "skills/video-understanding");

export async function copyVideoDependency(modules: string): Promise<void> {
  const dependency = await realpath(path.join(root, "node_modules/valibot"));
  await mkdir(modules, { recursive: true });
  await cp(dependency, path.join(modules, "valibot"), {
    recursive: true,
    dereference: true
  });
}

export async function copiedSkill(
  work: (fixture: {
    directory: string;
    installed: string;
    entry: string;
    home: string;
  }) => Promise<void>
): Promise<void> {
  const temporary = await mkdtemp(path.join(tmpdir(), "video-candidate-test-"));
  try {
    const directory = await realpath(temporary);
    assert.equal(directory.startsWith(root + path.sep), false);
    const installed = path.join(directory, "installed skill");
    await cp(skill, installed, {
      recursive: true,
      filter: (source) => path.basename(source) !== "node_modules"
    });
    const home = path.join(directory, "fixture home");
    await mkdir(home);
    await work({
      directory,
      installed,
      entry: path.join(installed, "scripts/video.ts"),
      home
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function fileSnapshot(
  directory: string
): Promise<
  readonly { name: string; hash: string | null; link: string | null }[]
> {
  const files = await readdir(directory, {
    recursive: true,
    withFileTypes: true
  });
  files.sort((left, right) =>
    path
      .join(left.parentPath, left.name)
      .localeCompare(path.join(right.parentPath, right.name))
  );
  return Promise.all(
    files.map(async (file) => {
      const absolute = path.join(file.parentPath, file.name);
      return {
        name: path.relative(directory, absolute),
        hash: file.isFile()
          ? createHash("sha256")
              .update(await readFile(absolute))
              .digest("hex")
          : null,
        link: file.isSymbolicLink() ? await readlink(absolute) : null
      };
    })
  );
}
