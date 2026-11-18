import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseNativeReleasePair } from "../../skill-package/src/native-release-manifest.ts";
import { runNativeUpdaterCli } from "../src/native/cli.ts";
import { prepareNativeBundle } from "../src/native/bundle.ts";
import { applyOverlay } from "../src/native/overlay.ts";
import { releaseFixture } from "./native-release-fixture.ts";

async function withCli(
  action: (fixture: {
    root: string;
    requests: string[];
    run: (args: string[], bootstrap?: boolean) => Promise<number>;
    seed: () => Promise<void>;
  }) => Promise<void>
): Promise<void> {
  const {
    role,
    target,
    packageZip,
    runtimeZip,
    packageName,
    manifest,
    assets,
    payloads
  } = releaseFixture();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "native-cli-"));
  const original = globalThis.fetch;
  const token = process.env.GITHUB_TOKEN;
  const requests: string[] = [];
  try {
    process.env.GITHUB_TOKEN = "fixture-token";
    globalThis.fetch = (async (request: string | URL | Request) => {
      const url =
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.href
            : request.url;
      requests.push(url);
      if (url.endsWith("/releases/latest"))
        return Response.json({
          assets,
          tag_name: "fixture",
          html_url: "https://github.com/owner/repo/releases/tag/fixture"
        });
      const index = assets.findIndex((item) => item.url === url);
      assert.ok(index >= 0);
      return new Response(payloads[index]);
    }) as typeof fetch;
    const config = {
      repo: "owner/repo",
      skillName: role,
      releaseAssetName: packageName,
      releaseManifestAssetName: "skill-release-manifest.json",
      sourcePath: `skills/${role}`
    };
    const run = async (args: string[], bootstrap = false) =>
      await runNativeUpdaterCli(config, role, import.meta.url, args, bootstrap);
    const seed = async () =>
      await applyOverlay(
        root,
        prepareNativeBundle({
          role,
          target,
          release: parseNativeReleasePair(manifest)[role],
          packageZip,
          runtimeZip
        }),
        async () => {}
      );
    await action({ root, run, seed, requests });
  } finally {
    globalThis.fetch = original;
    if (token === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = token;
    await fs.rm(root, { recursive: true, force: true });
  }
}

const linux = process.platform === "linux" && process.arch === "x64";
const supported =
  linux || (process.platform === "win32" && process.arch === "x64");

test(
  "native check only reads the manifest and leaves existing files unchanged",
  { skip: !supported },
  async () => {
    await withCli(async ({ root, run, seed, requests }) => {
      await seed();
      const names = [
        "SKILL.md",
        "native-runtime.json",
        "references/decision-index.schema.json",
        "scripts/update-skill.ts",
        "bin/decision-records"
      ];
      const snapshot = async () =>
        await Promise.all(
          names.map(async (name) => ({
            bytes: await fs.readFile(path.join(root, name)),
            mode: (await fs.stat(path.join(root, name))).mode
          }))
        );
      const before = await snapshot();
      assert.equal(await run(["--check", "--target-dir", root], true), 0);
      assert.deepEqual(await snapshot(), before);
      assert.equal(requests.length, 2);
      assert.ok(requests[0]?.endsWith("/releases/latest"));
      assert.ok(requests[1]?.endsWith("/releases/assets/1"));
    });
  }
);

test("native installer requires explicit target before network", async () => {
  await withCli(async ({ run, requests }) => {
    await assert.rejects(run([], true), /requires an explicit --target-dir/);
    assert.deepEqual(requests, []);
  });
});

test(
  "native installer without confirmation leaves missing target untouched",
  { skip: !supported || Boolean(process.stdin.isTTY) },
  async () => {
    await withCli(async ({ root, run }) => {
      const target = path.join(root, ".codex", "skills", "decision-records");
      assert.equal(await run(["--target-dir", target], true), 1);
      assert.deepEqual(await fs.readdir(root), []);
    });
  }
);

test(
  "native installer creates nested target after confirmation",
  { skip: !linux },
  async () => {
    await withCli(async ({ root, run }) => {
      const target = path.join(root, ".codex", "skills", "decision-records");
      assert.equal(await run(["--check", "--target-dir", target], true), 1);
      assert.deepEqual(await fs.readdir(root), []);
      assert.equal(await run(["--yes", "--target-dir", target], true), 0);
      assert.match(
        await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
        /version: "110"/
      );
      assert.ok(
        (await fs.stat(path.join(target, "bin", "decision-records"))).mode &
          0o111
      );
    });
  }
);

test(
  "native updater upgrades a relocated installation",
  { skip: !linux },
  async () => {
    await withCli(async ({ root, run, seed }) => {
      await seed();
      await fs.writeFile(
        path.join(root, "SKILL.md"),
        '---\nname: decision-records\nmetadata:\n  version: "109"\n---\n'
      );
      await fs.writeFile(
        path.join(root, ".record-native-receipt.json"),
        '{"backup":"/old/path"}'
      );
      await fs.writeFile(path.join(root, "sentinel"), "keep");
      const moved = path.join(root, "moved");
      const selected = [
        "SKILL.md",
        "native-runtime.json",
        "references",
        "scripts",
        "bin",
        ".record-native-receipt.json",
        "sentinel"
      ];
      await fs.mkdir(moved);
      for (const name of selected)
        await fs.cp(path.join(root, name), path.join(moved, name), {
          recursive: true
        });
      assert.equal(await run(["--yes", "--target-dir", moved]), 0);
      assert.equal(
        await fs.readFile(
          path.join(moved, ".record-native-receipt.json"),
          "utf8"
        ),
        '{"backup":"/old/path"}'
      );
      assert.equal(
        await fs.readFile(path.join(moved, "sentinel"), "utf8"),
        "keep"
      );
      assert.match(
        await fs.readFile(path.join(moved, "SKILL.md"), "utf8"),
        /version: "110"/
      );
    });
  }
);

test(
  "native installer explicitly reinstalls the same version",
  { skip: !linux },
  async () => {
    await withCli(async ({ root, run, seed }) => {
      await seed();
      await fs.unlink(path.join(root, "bin", "decision-records"));
      assert.equal(await run(["--check", "--target-dir", root]), 0);
      assert.equal(await run(["--yes", "--target-dir", root], true), 0);
      assert.ok(
        (await fs.stat(path.join(root, "bin", "decision-records"))).mode & 0o111
      );
    });
  }
);

test(
  "resource installer selects third-role release and rejects old two-role manifest",
  { skip: !supported },
  async () => {
    const { fixture } =
      await import("../../../scripts/lib/record-native/tests/candidate-publish-fixture.ts");
    const candidate = fixture();
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "native-resource-cli-")
    );
    const original = globalThis.fetch;
    const token = process.env.GITHUB_TOKEN;
    let manifest = candidate.manifest;
    try {
      process.env.GITHUB_TOKEN = "fixture-token";
      globalThis.fetch = (async (request: string | URL | Request) => {
        const url =
          typeof request === "string"
            ? request
            : request instanceof URL
              ? request.href
              : request.url;
        if (url.endsWith("/releases/latest"))
          return Response.json({
            assets: [
              {
                name: "skill-release-manifest.json",
                url: "https://api.github.com/repos/owner/repo/releases/assets/1"
              }
            ],
            tag_name: "fixture",
            html_url: "https://github.com/owner/repo/releases/tag/fixture"
          });
        return new Response(JSON.stringify(manifest));
      }) as typeof fetch;
      const config = {
        repo: "owner/repo",
        skillName: "resource-records",
        releaseAssetName: "resource-records-native.zip",
        releaseManifestAssetName: "skill-release-manifest.json",
        sourcePath: "skills/resource-records"
      };
      const run = () =>
        runNativeUpdaterCli(
          config,
          "resource-records",
          import.meta.url,
          ["--check", "--target-dir", root],
          true
        );
      assert.equal(await run(), 1);
      const skills = { ...manifest.skills };
      delete skills["resource-records"];
      manifest = { ...manifest, skills };
      await assert.rejects(run, /native release missing: resource-records/);
    } finally {
      globalThis.fetch = original;
      if (token === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = token;
      await fs.rm(root, { recursive: true, force: true });
    }
  }
);
