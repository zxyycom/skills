import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  readFile,
  symlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { complete } from "./fixtures/evidence-state.ts";
import { copiedSkill, copyVideoDependency } from "./fixtures/distribution.ts";
import { runProcess } from "./fixtures/process.ts";

test(
  "user project CLI and adapter defaults preserve field precedence and lazy runtime failure identity",
  { timeout: 30_000 },
  async () =>
    copiedSkill(async ({ directory, installed, entry, home }) => {
      await copyVideoDependency(path.join(installed, "node_modules"));
      const fixture = path.join(directory, "fixture");
      await mkdir(fixture);
      const index = await complete(fixture);
      const sourceIdentity = createHash("sha256")
        .update(index.source.file)
        .digest("hex");
      const dataRoot = path.join(directory, "user data");
      const userOutput = path.join(dataRoot, "evidence", sourceIdentity);
      await cp(fixture, userOutput, { recursive: true });
      const projectData = path.join(directory, "project data");
      const projectOutput = path.join(projectData, "evidence", sourceIdentity);
      await cp(fixture, projectOutput, { recursive: true });
      const userConfig = path.join(
        home,
        ".config/video-understanding/config.json"
      );
      await mkdir(path.dirname(userConfig), { recursive: true });
      await writeFile(
        userConfig,
        JSON.stringify({
          dataRoot,
          appRoot: path.join(directory, "user missing app")
        })
      );
      const projectConfig = path.join(directory, "selected.json");
      await writeFile(
        projectConfig,
        JSON.stringify({ dataRoot: projectData, appRoot: null })
      );
      const invoke = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
        runProcess(
          "node",
          [
            path.join(import.meta.dirname, "fixtures/invoke-public.mjs"),
            entry,
            ...args,
            "--format",
            "json"
          ],
          {
            cwd: home,
            reject: false,
            env: {
              HOME: home,
              USERPROFILE: home,
              VIDEO_TEST_EVIDENCE_ROOT: path.join(directory, "fallback"),
              VIDEO_TEST_APP_ROOT: path.join(directory, "adapter target"),
              VIDEO_TEST_THROW_APP: "1",
              ...extra
            }
          }
        );
      for (const [args, output] of [
        [[], userOutput],
        [["--config", projectConfig], projectOutput],
        [["--config", projectConfig, "--output", fixture], fixture]
      ] as const) {
        const result = await invoke([
          "read",
          "--input",
          index.source.file,
          ...args
        ]);
        assert.equal(result.exitCode, 0, result.stderr);
        assert.equal(JSON.parse(result.stdout).output, output);
        assert.match(result.stderr, /fixture:return=undefined;resolver=0/);
      }
      const selected = await invoke([
        "prepare",
        "--input",
        index.source.file,
        "--config",
        projectConfig
      ]);
      assert.equal(selected.exitCode, 0);
      assert.equal(JSON.parse(selected.stdout).reused, true);
      assert.match(selected.stderr, /resolver=0/);
      const userApp = await invoke([
        "frames",
        "--input",
        index.source.file,
        "--output",
        fixture,
        "--times",
        "2",
        "--config",
        projectConfig
      ]);
      assert.equal(userApp.exitCode, 1);
      assert.ok(
        userApp.stderr.includes(path.join(directory, "user missing app"))
      );
      assert.match(userApp.stderr, /resolver=0/);
      const explicitApp = path.join(directory, "explicit app");
      const explicit = await invoke([
        "frames",
        "--input",
        index.source.file,
        "--output",
        fixture,
        "--times",
        "2",
        "--app-root",
        explicitApp
      ]);
      assert.ok(explicit.stderr.includes(explicitApp));
      assert.match(explicit.stderr, /resolver=0/);
      await writeFile(userConfig, "{}");
      await writeFile(projectConfig, "{}");
      const resolver = await invoke([
        "frames",
        "--input",
        index.source.file,
        "--output",
        fixture,
        "--times",
        "2"
      ]);
      assert.equal(resolver.exitCode, 1);
      assert.match(resolver.stderr, /environment at runtime/);
      assert.ok(
        resolver.stderr.includes(path.join(directory, "adapter target"))
      );
      assert.match(resolver.stderr, /fixture resolver failure/);
      assert.match(resolver.stderr, /resolver=1/);
      const fallback = await invoke(["read", "--input", index.source.file]);
      assert.ok(
        fallback.stderr.includes(
          path.join(directory, "fallback", sourceIdentity)
        )
      );
      await assert.rejects(access(path.join(directory, "fallback")), {
        code: "ENOENT"
      });
    })
);

test(
  "distributed resources follow the public physical entry and package-local roots remain forbidden through aliases",
  { timeout: 30_000 },
  async () =>
    copiedSkill(async ({ directory, installed, entry, home }) => {
      await copyVideoDependency(path.join(installed, "node_modules"));
      const alias = path.join(directory, "entry alias");
      await symlink(
        installed,
        alias,
        process.platform === "win32" ? "junction" : "dir"
      );
      const aliasEntry = path.join(alias, "scripts/video.ts");
      const help = await runProcess("node", [aliasEntry, "--help"], {
        cwd: home
      });
      assert.match(help.stdout, /prepare/);
      const source = path.join(directory, "source.mp4");
      await writeFile(source, "synthetic source");
      for (const selected of [installed, alias]) {
        const result = await runProcess(
          "node",
          [
            entry,
            "prepare",
            "--input",
            source,
            "--output",
            path.join(selected, "data")
          ],
          { reject: false }
        );
        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, /outside the skill installation/);
      }
      const appRoot = path.join(directory, "media fixture");
      const analyzer = path.join(appRoot, "node_modules/mcp-video-analyzer");
      const ffmpeg = path.join(appRoot, "node_modules/ffmpeg-static");
      await mkdir(analyzer, { recursive: true });
      await mkdir(ffmpeg, { recursive: true });
      await writeFile(path.join(analyzer, "package.json"), "{}");
      await writeFile(
        path.join(ffmpeg, "package.json"),
        '{"main":"program.json"}'
      );
      await writeFile(
        path.join(ffmpeg, "program.json"),
        JSON.stringify("fixture-program-never-started")
      );
      const receipt = path.join(directory, "resource-receipt.json");
      const result = await runProcess(
        "node",
        [
          "--import",
          pathToFileURL(
            path.join(import.meta.dirname, "fixtures/resource-probe.mjs")
          ).href,
          aliasEntry,
          "prepare",
          "--input",
          source,
          "--output",
          path.join(directory, "output"),
          "--app-root",
          appRoot
        ],
        {
          cwd: home,
          reject: false,
          env: {
            SystemRoot: process.env.SystemRoot ?? "C:/Windows",
            VIDEO_TEST_RECEIPT: receipt
          }
        }
      );
      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /inspection|runtime/);
      const observed = JSON.parse(await readFile(receipt, "utf8"));
      assert.deepEqual(observed.reads, [
        path.join(installed, "scripts/runtime.env")
      ]);
      assert.equal(observed.args[1], path.join(installed, "scripts/media.py"));
      assert.equal(observed.environment.HF_HUB_OFFLINE, "1");
      assert.equal(observed.environment.HF_HUB_DISABLE_IMPLICIT_TOKEN, "true");
      await assert.rejects(access(path.join(installed, "data")), {
        code: "ENOENT"
      });
    })
);
