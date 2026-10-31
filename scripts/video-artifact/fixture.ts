import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { runCommand } from "../environment/environment-command.js";
import { fileSnapshot } from "../../tools/video-understanding/tests/fixtures/distribution.ts";
import { root } from "../../tools/video-understanding/tests/fixtures/public-cli.ts";
import { runProcess } from "../../tools/video-understanding/tests/fixtures/process.ts";

export { fileSnapshot, runProcess };

export async function extractArtifact() {
  const artifact = process.env.VIDEO_SKILL_ARTIFACT;
  assert.ok(
    artifact && path.isAbsolute(artifact),
    "VIDEO_SKILL_ARTIFACT must name an explicit absolute zip path"
  );
  const files = unzipSync(await readFile(artifact));
  const directory = await mkdtemp(path.join(tmpdir(), "video-artifact-"));
  try {
    const physical = await realpath(directory);
    assert.equal(physical.startsWith(root + path.sep), false);
    for (let ancestor = physical; ; ancestor = path.dirname(ancestor)) {
      await assert.rejects(access(path.join(ancestor, "node_modules")), {
        code: "ENOENT"
      });
      if (ancestor === path.dirname(ancestor)) break;
    }
    const installed = path.join(physical, "中文 空格", "video-understanding");
    await mkdir(installed, { recursive: true });
    for (const [name, data] of Object.entries(files)) {
      const segments = name.split("/");
      assert.equal(
        segments.shift(),
        "video-understanding",
        `unexpected archive member ${name}`
      );
      if (segments.at(-1) === "") segments.pop();
      assert.ok(
        !segments.some(
          (part) =>
            !part || part === "." || part === ".." || /[\\:\0]/u.test(part)
        ),
        `unsafe archive member ${name}`
      );
      assert.ok(
        !segments.includes("node_modules"),
        "archive must not contain dependencies"
      );
      assert.notEqual(
        segments.join("/"),
        "config.json",
        "archive must not contain user configuration"
      );
      const target = path.join(installed, ...segments);
      if (name.endsWith("/")) await mkdir(target, { recursive: true });
      else {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, data);
      }
    }
    const home = path.join(physical, "用户 home");
    await mkdir(home);
    const entry = path.join(installed, "scripts/video.ts");
    const env = {
      HOME: home,
      USERPROFILE: home,
      BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0"
    };
    return { directory: physical, installed, home, entry, env, files };
  } catch (error) {
    await removeFixture(directory);
    throw error;
  }
}

export type ArtifactFixture = Awaited<ReturnType<typeof extractArtifact>>;

export async function removeFixture(directory: string): Promise<void> {
  const resolved = await realpath(directory);
  assert.equal(path.dirname(resolved), await realpath(tmpdir()));
  assert.ok(path.basename(resolved).startsWith("video-artifact-"));
  await rm(resolved, { recursive: true, force: true });
}

export async function frozenInstall(installed: string): Promise<void> {
  const lock = await readFile(path.join(installed, "pnpm-lock.yaml"), "utf8");
  const result = runCommand("pnpm", [
    "--dir",
    installed,
    "install",
    "--ignore-workspace",
    "--prod",
    "--frozen-lockfile",
    "--config.node-linker=isolated"
  ]);
  assert.equal(result.resolutionError, null, result.resolutionError ?? "");
  assert.equal(result.exitCode, 0, result.output);
  assert.equal(
    await readFile(path.join(installed, "pnpm-lock.yaml"), "utf8"),
    lock
  );
  await access(path.join(installed, "node_modules/valibot/package.json"));
}
