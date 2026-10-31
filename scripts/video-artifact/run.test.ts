import assert from "node:assert/strict";
import {
  access,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { complete } from "../../tools/video-understanding/tests/fixtures/evidence-state.ts";
import { readSkillVersionFromMarkdown } from "../../tools/skill-package/src/version.ts";
import {
  extractArtifact,
  fileSnapshot,
  frozenInstall,
  removeFixture,
  runProcess,
  type ArtifactFixture
} from "./fixture.ts";

let fixture: ArtifactFixture;
let missing: Awaited<ReturnType<typeof runProcess>>;
before(
  async () => {
    fixture = await extractArtifact();
    missing = await runProcess("node", [fixture.entry, "--help"], {
      cwd: fixture.home,
      env: fixture.env,
      reject: false
    });
    await assert.rejects(access(path.join(fixture.installed, "node_modules")), {
      code: "ENOENT"
    });
    await frozenInstall(fixture.installed);
  },
  { timeout: 120_000 }
);
after(async () => {
  if (fixture) await removeFixture(fixture.directory);
});

test("actual video zip diagnoses missing dependencies without installing and frozen installation restores the entry", async () => {
  assert.equal(missing.exitCode, 1);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /valibot|ERR_MODULE_NOT_FOUND/);
  assert.match(missing.stderr, /No installation was attempted/);
  assert.match(
    missing.stderr,
    /--ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated/
  );
  const help = await runProcess("node", [fixture.entry, "--help"], {
    cwd: fixture.home,
    env: fixture.env
  });
  assert.match(help.stdout, /--config/);
  const lock = fixture.files["video-understanding/pnpm-lock.yaml"];
  assert.ok(lock);
  assert.deepEqual(
    await readFile(path.join(fixture.installed, "pnpm-lock.yaml")),
    Buffer.from(lock)
  );
});

test("actual video zip runs Node and Bun in Chinese space paths with external configuration evidence and pure reuse", async () => {
  const { directory, installed, entry, home, env } = fixture;
  const output = path.join(directory, "包外 证据");
  await mkdir(output);
  const evidence = await complete(output);
  const config = path.join(directory, "项目 配置.json");
  await writeFile(
    config,
    JSON.stringify({
      appRoot: path.join(directory, "missing media"),
      dataRoot: null
    })
  );
  const user = path.join(home, ".config/video-understanding/config.json");
  await mkdir(path.dirname(user), { recursive: true });
  await writeFile(
    user,
    JSON.stringify({ dataRoot: path.join(directory, "用户 数据") })
  );
  const before = await fileSnapshot(installed);
  const homeBefore = await fileSnapshot(home);
  for (const runtime of ["node", "bun"]) {
    const invoke = (args: string[]) =>
      runProcess(runtime, [entry, ...args], { cwd: home, env, reject: false });
    const help = await invoke(["--help"]);
    assert.equal(help.exitCode, 0, help.stderr);
    for (const command of ["read", "prepare"]) {
      const result = await invoke([
        command,
        "--input",
        evidence.source.file,
        "--output",
        output,
        "--config",
        config,
        "--format",
        "json"
      ]);
      assert.equal(result.exitCode, 0, result.stderr);
      const value = JSON.parse(result.stdout);
      assert.equal(value.scopeId, evidence.scopeId);
      if (command === "prepare") assert.equal(value.reused, true);
    }
    const bad = await invoke(["read", "--output", output, "--unknown"]);
    assert.equal(bad.exitCode, 1);
    assert.equal(bad.stdout, "");
    assert.match(bad.stderr, /arguments/);
  }
  const imported = await runProcess(
    "node",
    [
      path.resolve(
        import.meta.dirname,
        "../../tools/video-understanding/tests/fixtures/import-public.mjs"
      ),
      entry,
      "--invalid"
    ],
    { cwd: home, env }
  );
  assert.equal(imported.stdout, "");
  assert.equal(imported.stderr, "");
  assert.deepEqual(await fileSnapshot(installed), before);
  assert.deepEqual(await fileSnapshot(home), homeBefore);
  assert.equal(
    await readFile(evidence.source.file, "utf8"),
    "synthetic source"
  );
  await assert.rejects(access(path.join(directory, "用户 数据")), {
    code: "ENOENT"
  });
});

test("actual video zip resolves package resources through its physical alias and rejects package-local evidence", async () => {
  const { directory, installed, entry, home, env } = fixture;
  const alias = path.join(directory, "中文 别名");
  await symlink(
    installed,
    alias,
    process.platform === "win32" ? "junction" : "dir"
  );
  const aliasEntry = path.join(alias, "scripts/video.ts");
  const source = path.join(directory, "资源 输入.mp4");
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
      { cwd: home, env, reject: false }
    );
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /outside the skill installation/);
  }
  const appRoot = path.join(directory, "包外 media");
  const analyzer = path.join(appRoot, "node_modules/mcp-video-analyzer");
  const ffmpeg = path.join(appRoot, "node_modules/ffmpeg-static");
  await mkdir(analyzer, { recursive: true });
  await mkdir(ffmpeg, { recursive: true });
  await writeFile(path.join(analyzer, "package.json"), "{}");
  await writeFile(path.join(ffmpeg, "package.json"), '{"main":"program.json"}');
  await writeFile(
    path.join(ffmpeg, "program.json"),
    JSON.stringify("fixture-program-never-started")
  );
  const receipt = path.join(directory, "资源 receipt.json");
  const probe = path.resolve(
    import.meta.dirname,
    "../../tools/video-understanding/tests/fixtures/resource-probe.mjs"
  );
  const result = await runProcess(
    "node",
    [
      "--import",
      pathToFileURL(probe).href,
      aliasEntry,
      "prepare",
      "--input",
      source,
      "--output",
      path.join(directory, "资源 输出"),
      "--app-root",
      appRoot
    ],
    {
      cwd: home,
      reject: false,
      env: {
        ...env,
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
  await access(path.join(installed, "scripts/rapidocr.py"));
  await access(path.join(installed, "runtime/ocr-profiles.json"));
  await assert.rejects(access(path.join(installed, "data")), {
    code: "ENOENT"
  });
});

test("actual video zip terminates timed out and cancelled process trees while preserving failure diagnostics", async () => {
  const result = await runProcess(
    "node",
    [
      path.join(import.meta.dirname, "process-probe.mjs"),
      fixture.installed,
      fixture.directory
    ],
    { cwd: fixture.home, env: fixture.env }
  );
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /timeout and cancellation trees stopped/);
});

test(
  "actual video zip updater checks offline replaces shipped files and preserves extra files dependencies configuration and evidence",
  { timeout: 120_000 },
  async () => {
    const { directory, installed, entry, home, env, files } = fixture;
    const skill = path.join(installed, "SKILL.md");
    const current = await readFile(skill, "utf8");
    const manifest = path.join(directory, "offline-manifest.json");
    await writeFile(
      manifest,
      JSON.stringify({
        schemaVersion: 1,
        skills: {
          "video-understanding": {
            version: readSkillVersionFromMarkdown(current, skill)
          }
        }
      })
    );
    const local = current.replace(/version: "[1-9]\d*"/u, 'version: "1"');
    assert.notEqual(
      local,
      current,
      "fixture requires a remote version greater than 1"
    );
    await writeFile(skill, local);
    const customized = path.join(
      installed,
      "scripts/runtime/tools/video-understanding/src/evidence/text.ts"
    );
    await writeFile(customized, "// local customization must be overwritten\n");
    const extra = path.join(installed, "保留 定制.txt");
    await writeFile(extra, "preserve extra local file");
    const config = path.join(home, ".config/video-understanding/config.json");
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(
      config,
      JSON.stringify({ dataRoot: path.join(directory, "保留 数据") })
    );
    const depsBefore = await fileSnapshot(path.join(installed, "node_modules"));
    const homeBefore = await fileSnapshot(home);
    const evidence = path.join(directory, "已有 证据");
    await mkdir(evidence);
    await complete(evidence);
    const evidenceBefore = await fileSnapshot(evidence);
    const requests = path.join(directory, "offline-requests.json");
    const invoke = (args: string[]) =>
      runProcess(
        "node",
        [
          "--import",
          pathToFileURL(path.join(import.meta.dirname, "offline-release.mjs"))
            .href,
          path.join(installed, "scripts/update-skill.ts"),
          ...args
        ],
        {
          cwd: home,
          env: {
            ...env,
            VIDEO_SKILL_ARTIFACT: process.env.VIDEO_SKILL_ARTIFACT,
            VIDEO_ARTIFACT_REQUESTS: requests,
            VIDEO_ARTIFACT_MANIFEST: manifest,
            GH_TOKEN: "",
            GITHUB_TOKEN: ""
          },
          reject: false
        }
      );
    const before = await fileSnapshot(installed);
    const check = await invoke(["--check"]);
    assert.equal(check.exitCode, 1, check.stderr);
    assert.match(check.stdout, /Status: update available/);
    assert.deepEqual(await fileSnapshot(installed), before);
    assert.equal(
      (await readFile(requests, "utf8")).includes("/archive"),
      false
    );
    const update = await invoke(["--yes"]);
    assert.equal(update.exitCode, 0, update.stderr);
    assert.match(update.stdout, /Updated skill successfully/);
    for (const [name, data] of Object.entries(files)) {
      if (!name.endsWith("/"))
        assert.deepEqual(
          await readFile(
            path.join(installed, name.slice("video-understanding/".length))
          ),
          Buffer.from(data),
          name
        );
    }
    assert.equal(await readFile(extra, "utf8"), "preserve extra local file");
    assert.deepEqual(
      await fileSnapshot(path.join(installed, "node_modules")),
      depsBefore
    );
    assert.deepEqual(await fileSnapshot(home), homeBefore);
    assert.deepEqual(await fileSnapshot(evidence), evidenceBefore);
    assert.deepEqual(JSON.parse(await readFile(requests, "utf8")), [
      "https://api.github.com/repos/zxyycom/skills/releases/latest",
      "https://fixture.invalid/manifest",
      "https://fixture.invalid/archive"
    ]);
    const modules = path.resolve(installed, "node_modules");
    assert.ok(modules.startsWith(directory + path.sep));
    await rm(modules, { recursive: true });
    const missing = await runProcess("node", [entry, "--help"], {
      cwd: home,
      env,
      reject: false
    });
    assert.equal(missing.exitCode, 1);
    await frozenInstall(installed);
    assert.equal(
      (await runProcess("node", [entry, "--help"], { cwd: home, env }))
        .exitCode,
      0
    );
    assert.deepEqual(await fileSnapshot(home), homeBefore);
    assert.deepEqual(await fileSnapshot(evidence), evidenceBefore);
  }
);
