import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { loadNativeReleaseBundle } from "../src/native/release.ts";
import { runNativeUpdaterCli } from "../src/native/cli.ts";
import { activateNativeBundle } from "../src/native/native-transaction.ts";
import { nativeHostTarget } from "../src/native/runtime-validation.ts";

test("native release fetch is pinned to one repository and validates downloaded assets", async () => {
  const role = "decision-records";
  const target = "x86_64-unknown-linux-gnu";
  const hash = "a".repeat(64);
  const descriptor = {
    schemaVersion: 1,
    role,
    runtimeVersion: "0.1.0",
    sourceHash: hash,
    targets: [target, "x86_64-pc-windows-msvc"]
  };
  const packageZip = zipSync({
    [`${role}/SKILL.md`]: strToU8(
      '---\nname: decision-records\nmetadata:\n  version: "110"\n---\n'
    ),
    [`${role}/native-runtime.json`]: strToU8(JSON.stringify(descriptor)),
    [`${role}/references/decision-index.schema.json`]: strToU8("{}"),
    [`${role}/scripts/update-skill.ts`]: strToU8("fixture")
  });
  const runtimeZip = zipSync({ [role]: strToU8("binary") });
  const windowsRuntimeZip = zipSync({ [`${role}.exe`]: strToU8("binary") });
  const packageName = `${role}-native.zip`;
  const runtimeName = `${role}-0.1.0-${target}.zip`;
  const asset = (name: string, bytes: Uint8Array) => ({
    name,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
  const manifest = {
    schemaVersion: 1,
    skills: {
      [role]: {
        version: 110,
        native: {
          schemaVersion: 1,
          runtimeVersion: "0.1.0",
          sourceHash: hash,
          package: asset(packageName, packageZip),
          targets: {
            [target]: asset(runtimeName, runtimeZip),
            "x86_64-pc-windows-msvc": asset(
              `${role}-0.1.0-x86_64-pc-windows-msvc.zip`,
              windowsRuntimeZip
            )
          },
          bootstrap: asset("record-native-installer.zip", runtimeZip)
        }
      },
      "investigation-report": {
        version: 99,
        native: {
          schemaVersion: 1,
          runtimeVersion: "0.1.0",
          sourceHash: hash,
          package: asset("investigation-report-native.zip", packageZip),
          targets: {
            [target]: asset(
              `investigation-report-0.1.0-${target}.zip`,
              runtimeZip
            ),
            "x86_64-pc-windows-msvc": asset(
              "investigation-report-0.1.0-x86_64-pc-windows-msvc.zip",
              runtimeZip
            )
          },
          bootstrap: asset("record-native-installer.zip", runtimeZip)
        }
      }
    }
  };
  const base = "https://api.github.com/repos/owner/repo/releases/assets/";
  const assets = [
    "skill-release-manifest.json",
    packageName,
    runtimeName,
    `${role}-0.1.0-x86_64-pc-windows-msvc.zip`
  ].map((name, index) => ({ name, url: `${base}${index + 1}` }));
  const payloads = [
    strToU8(JSON.stringify(manifest)),
    packageZip,
    runtimeZip,
    windowsRuntimeZip
  ];
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (request: string | URL | Request) => {
    const url =
      typeof request === "string"
        ? request
        : request instanceof URL
          ? request.href
          : request.url;
    requests.push(url);
    const index = assets.findIndex((item) => item.url === url);
    assert.ok(index >= 0);
    return new Response(payloads[index]);
  }) as typeof fetch;
  try {
    const input = {
      repo: "owner/repo",
      assets,
      role,
      target,
      token: null
    } as const;
    const files = await loadNativeReleaseBundle(input);
    assert.equal(
      files.find((item) => item.path === `bin/${role}`)?.data.toString(),
      "binary"
    );
    assert.deepEqual(
      requests,
      assets.slice(0, 3).map((item) => item.url)
    );
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "native-cli-check-"));
    const originalToken = process.env.GITHUB_TOKEN;
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
      assert.equal(
        await runNativeUpdaterCli(
          config,
          role,
          import.meta.url,
          ["--check", "--target-dir", root],
          true
        ),
        1
      );
      assert.deepEqual(await fs.readdir(root), []);
      const host = nativeHostTarget();
      await activateNativeBundle({
        role,
        target: host,
        destination: root,
        manifestBytes: payloads[0]!,
        packageZip,
        runtimeZip:
          host === "x86_64-pc-windows-msvc" ? windowsRuntimeZip : runtimeZip,
        confirm: async () => true,
        validatePrepared: async () => {}
      });
      const unrelated = structuredClone(manifest);
      unrelated.skills["investigation-report"].version = 100;
      payloads[0] = strToU8(JSON.stringify(unrelated));
      assert.equal(
        await runNativeUpdaterCli(
          config,
          role,
          import.meta.url,
          ["--check", "--target-dir", root],
          true
        ),
        0
      );
      await assert.rejects(
        () => runNativeUpdaterCli(config, role, import.meta.url, [], true),
        /requires an explicit --target-dir/
      );
    } finally {
      if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = originalToken;
      await fs.rm(root, { recursive: true, force: true });
    }
    globalThis.fetch = (async (request: string | URL | Request) => {
      const url =
        typeof request === "string"
          ? request
          : request instanceof URL
            ? request.href
            : request.url;
      requests.push(url);
      const index = assets.findIndex((item) => item.url === url);
      assert.ok(index >= 0);
      return new Response(payloads[index]);
    }) as typeof fetch;
    requests.length = 0;
    await assert.rejects(
      loadNativeReleaseBundle({
        ...input,
        assets: [{ ...assets[0]!, url: "https://evil.example/1" }]
      }),
      /origin/
    );
    assert.equal(requests.length, 0);
    await assert.rejects(
      loadNativeReleaseBundle({ ...input, assets: [assets[0]!, assets[0]!] }),
      /ambiguous/
    );
    assert.equal(requests.length, 0);
    globalThis.fetch = (async (request: string | URL | Request) => {
      assert.ok(request);
      return new Response(new Uint8Array(1024 * 1024 + 1));
    }) as typeof fetch;
    await assert.rejects(loadNativeReleaseBundle(input), /download limit/);
  } finally {
    globalThis.fetch = original;
  }
});
