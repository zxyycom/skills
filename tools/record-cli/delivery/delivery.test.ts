import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { installCandidate } from "./install.ts";
import { assetName, hostTarget, parseManifest, sha256 } from "./manifest.ts";

async function fixture(): Promise<{
  root: string;
  source: string;
  destination: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "record-delivery-"));
  const source = path.join(root, "assets");
  const destination = path.join(root, "fixture");
  await mkdir(source);
  await mkdir(destination);
  await writeFile(
    path.join(destination, ".record-cli-fixture"),
    "record-cli private fixture\n"
  );
  await writeFile(path.join(destination, "unrelated"), "keep");
  const assets = [];
  for (const role of ["decision-records", "investigation-report"] as const) {
    const bytes = Buffer.from(`candidate-${role}`);
    const file = assetName(role, hostTarget());
    await writeFile(path.join(source, file), bytes);
    assets.push({ role, file, size: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = {
    schemaVersion: 1,
    version: "1.0.0",
    target: hostTarget(),
    source: { sha256: "0".repeat(64), rustc: "fixture", cargo: "fixture" },
    assets
  };
  await writeFile(
    path.join(source, "record-cli-candidate.json"),
    JSON.stringify(manifest)
  );
  return { root, source, destination };
}

test("strict manifest binds roles, file names, target and digest", () => {
  const good = {
    schemaVersion: 1,
    version: "1.2.3",
    target: "x86_64-unknown-linux-gnu",
    source: { sha256: "a".repeat(64), rustc: "rustc", cargo: "cargo" },
    assets: [
      {
        role: "decision-records",
        file: "decision-records",
        size: 2,
        sha256: "b".repeat(64)
      },
      {
        role: "investigation-report",
        file: "investigation-report",
        size: 3,
        sha256: "c".repeat(64)
      }
    ]
  };
  assert.equal(parseManifest(good).version, "1.2.3");
  const windows = {
    ...good,
    target: "x86_64-pc-windows-msvc",
    assets: good.assets.map((item) => ({ ...item, file: `${item.role}.exe` }))
  };
  assert.equal(parseManifest(windows).target, windows.target);
  assert.throws(() => parseManifest({ ...windows, assets: good.assets }));
  assert.throws(() => parseManifest({ ...good, assets: windows.assets }));
  for (const target of [
    "aarch64-unknown-linux-gnu",
    "x86_64-unknown-linux-musl"
  ])
    assert.throws(() => parseManifest({ ...good, target }));
  assert.throws(() => parseManifest({ ...good, extra: true }));
  assert.throws(() =>
    parseManifest({ ...good, assets: [good.assets[0], good.assets[0]] })
  );
  assert.throws(() =>
    parseManifest({
      ...good,
      assets: [{ ...good.assets[0], file: "../escape" }, good.assets[1]]
    })
  );
  assert.throws(() =>
    parseManifest({ ...good, source: { ...good.source, sha256: "bad" } })
  );
});

test("install verifies bytes and rolls back actual replacements while preserving unrelated files", async () => {
  const { root, source, destination } = await fixture();
  try {
    await installCandidate({ source, destination, version: "1.0.0" });
    const originalNames = await readdir(destination);
    const originals = await Promise.all(
      originalNames.map(
        async (name) =>
          [name, await readFile(path.join(destination, name))] as const
      )
    );
    const manifestPath = path.join(source, "record-cli-candidate.json");
    const manifest = parseManifest(
      JSON.parse(await readFile(manifestPath, "utf8")) as unknown
    );
    const next = manifest.assets.map((item) => ({
      ...item,
      sha256: sha256(Buffer.from(`next-${item.role}`)),
      size: Buffer.byteLength(`next-${item.role}`)
    }));
    for (const item of next)
      await writeFile(path.join(source, item.file), `next-${item.role}`);
    await writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, version: "2.0.0", assets: next })
    );
    await assert.rejects(
      installCandidate({ source, destination, version: "2.0.0", failAfter: 1 }),
      /rolled back/
    );
    assert.deepEqual(await readdir(destination), originalNames);
    for (const [name, bytes] of originals)
      assert.deepEqual(await readFile(path.join(destination, name)), bytes);
    await installCandidate({ source, destination, version: "2.0.0" });
    for (const item of next)
      assert.equal(
        (await readFile(path.join(destination, item.file))).toString(),
        `next-${item.role}`
      );
    assert.equal(
      await readFile(path.join(destination, "unrelated"), "utf8"),
      "keep"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid identity, corruption and unsafe destination fail before writes", async () => {
  const { root, source, destination } = await fixture();
  try {
    await assert.rejects(
      installCandidate({ source, destination, version: "2.0.0" }),
      /mismatch/
    );
    await writeFile(path.join(source, "unexpected"), "extra");
    await assert.rejects(
      installCandidate({ source, destination, version: "1.0.0" }),
      /unexpected or missing/
    );
    await rm(path.join(source, "unexpected"));

    const manifest = parseManifest(
      JSON.parse(
        await readFile(path.join(source, "record-cli-candidate.json"), "utf8")
      ) as unknown
    );
    const manifestPath = path.join(source, "record-cli-candidate.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        ...manifest,
        target:
          manifest.target === "x86_64-pc-windows-msvc"
            ? "x86_64-unknown-linux-gnu"
            : "x86_64-pc-windows-msvc",
        assets: manifest.assets.map((item) => ({
          ...item,
          file: assetName(
            item.role,
            manifest.target === "x86_64-pc-windows-msvc"
              ? "x86_64-unknown-linux-gnu"
              : "x86_64-pc-windows-msvc"
          )
        }))
      })
    );
    await assert.rejects(
      installCandidate({ source, destination, version: "1.0.0" })
    );
    await writeFile(manifestPath, JSON.stringify(manifest));
    const first = manifest.assets[0];
    assert.ok(first);
    await writeFile(path.join(source, first.file), "corrupt");
    await assert.rejects(
      installCandidate({ source, destination, version: "1.0.0" }),
      /integrity/
    );
    assert.deepEqual(await readdir(destination), [
      ".record-cli-fixture",
      "unrelated"
    ]);
    // Restore a valid source so an integrity error cannot mask a marker failure.
    await writeFile(path.join(source, first.file), `candidate-${first.role}`);
    const marker = path.join(destination, ".record-cli-fixture");
    await writeFile(marker, "not a private fixture\n");
    await assert.rejects(
      installCandidate({ source, destination, version: "1.0.0" }),
      /destination is not a private fixture/
    );
    assert.deepEqual(await readdir(destination), [
      ".record-cli-fixture",
      "unrelated"
    ]);
    assert.equal(await readFile(marker, "utf8"), "not a private fixture\n");
    assert.equal(
      await readFile(path.join(destination, "unrelated"), "utf8"),
      "keep"
    );
    await rm(marker);
    await assert.rejects(
      installCandidate({ source, destination, version: "1.0.0" }),
      { code: "ENOENT" }
    );
    assert.deepEqual(await readdir(destination), ["unrelated"]);
    await writeFile(marker, "record-cli private fixture\n");
    {
      const link = path.join(root, "link");
      await symlink(destination, link, "dir");
      await assert.rejects(
        installCandidate({ source, destination: link, version: "1.0.0" }),
        /unsafe directory/
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
