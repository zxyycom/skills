import assert from "node:assert/strict";
import test from "node:test";
import { releaseFixture } from "./native-release-fixture.ts";
import {
  loadNativeManifest,
  loadNativeReleaseBundle
} from "../src/native/release.ts";

test("native release fetch is pinned to one repository and validates downloaded assets", async () => {
  const { role, target, assets, payloads } = releaseFixture();
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
    const files = await loadNativeReleaseBundle(
      input,
      (await loadNativeManifest(input))[role]
    );
    assert.equal(
      files.find((item) => item.path === `bin/${role}`)?.data.toString(),
      '#!/bin/sh\nif [ "$1" = --version ]; then echo decision-records 0.1.0; fi\n'
    );
    assert.equal(requests[0], assets[0]?.url);
    assert.deepEqual(
      [...requests].sort(),
      assets
        .slice(0, 3)
        .map((item) => item.url)
        .sort()
    );
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
      loadNativeManifest({
        ...input,
        assets: [{ ...assets[0]!, url: "https://evil.example/1" }]
      }),
      /origin/
    );
    assert.equal(requests.length, 0);
    await assert.rejects(
      loadNativeManifest({ ...input, assets: [assets[0]!, assets[0]!] }),
      /ambiguous/
    );
    assert.equal(requests.length, 0);
    globalThis.fetch = (async (request: string | URL | Request) => {
      assert.ok(request);
      return new Response(new Uint8Array(1024 * 1024 + 1));
    }) as typeof fetch;
    await assert.rejects(loadNativeManifest(input), /download limit/);
  } finally {
    globalThis.fetch = original;
  }
});
