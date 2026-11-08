import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as v from "valibot";
import { captureNativeCandidateSnapshot } from "./capture.ts";
import { legacyTargets } from "./ci-bootstrap-fixture.ts";
import { command, hash, unpack } from "./ci-bootstrap-process.ts";
import { nativeRoles } from "../../../tools/skill-package/src/native-release-manifest.ts";

const repo = "repos/zxyycom/skills";
const schema = v.object({
  id: v.number(),
  tag_name: v.literal("skills-latest"),
  assets: v.array(
    v.object({
      id: v.number(),
      name: v.string(),
      size: v.number(),
      digest: v.string()
    })
  )
});
function gh(args: string[]): Buffer {
  return command(
    "gh",
    ["api", "--hostname", "github.com", ...args],
    process.cwd()
  );
}
function revision(): string {
  const result = command(
    "git",
    ["ls-remote", "--refs", "origin", "refs/tags/skills-latest"],
    process.cwd()
  )
    .toString()
    .trim();
  const match = /^([a-f0-9]{40,64})\s+refs\/tags\/skills-latest$/.exec(result);
  if (!match?.[1]) throw new Error("cannot pin rolling revision");
  return match[1];
}
function downloadReleaseAssets(
  release: v.InferOutput<typeof schema>,
  names: readonly string[]
): Map<string, Buffer> {
  const assets = new Map<string, Buffer>();
  for (const name of names) {
    const matches = release.assets.filter((item) => item.name === name);
    assert.equal(matches.length, 1);
    const item = matches[0]!;
    const bytes = gh([
      "-H",
      "Accept: application/octet-stream",
      `${repo}/releases/assets/${item.id}`
    ]);
    assert.equal(bytes.length, item.size);
    assert.equal(`sha256:${hash(bytes)}`, item.digest);
    assets.set(name, bytes);
    console.log(
      `release=${release.id} asset=${item.id} name=${name} bytes=${item.size} digest=${item.digest}`
    );
  }
  return assets;
}

async function verifyInstallation(
  role: (typeof nativeRoles)[number],
  kind: string,
  destination: string,
  bootstrap: string,
  temp: string
): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, "sentinel.txt"), "keep", {
    flag: "wx"
  });
  command(
    process.execPath,
    [
      path.join(bootstrap, "scripts", `${role}.ts`),
      "--yes",
      "--target-dir",
      destination,
      "--release-tag",
      "skills-latest"
    ],
    temp
  );
  const binary = path.join(
    destination,
    "bin",
    `${role}${process.platform === "win32" ? ".exe" : ""}`
  );
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.2.0`
  );
  command(
    "pnpm",
    [
      "install",
      "--prod",
      "--frozen-lockfile",
      "--ignore-workspace",
      "--config.node-linker=isolated"
    ],
    destination
  );
  const updater = path.join(destination, "scripts/update-skill.ts");
  command(
    process.execPath,
    [updater, "--check", "--release-tag", "skills-latest"],
    destination
  );
  await fs.unlink(binary);
  const check = spawnSync(
    process.execPath,
    [updater, "--check", "--release-tag", "skills-latest"],
    { cwd: destination, env: process.env }
  );
  if (check.error) throw check.error;
  assert.equal(check.status, 1);
  command(
    process.execPath,
    [updater, "--yes", "--release-tag", "skills-latest"],
    destination
  );
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.2.0`
  );
  assert.equal(
    await fs.readFile(path.join(destination, "sentinel.txt"), "utf8"),
    "keep"
  );
  console.log(
    `PASS ${role} ${kind}: real release installation and missing binary repair`
  );
}

async function createAcceptanceDirectory(root: string): Promise<string> {
  const temp = await fs.mkdtemp(
    path.join(os.tmpdir(), "record-online-accept-")
  );
  const realRoot = await fs.realpath(root);
  const realTemp = await fs.realpath(temp);
  const relative = path.relative(realRoot, realTemp);
  if (
    !relative ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  )
    throw new Error(
      "online acceptance directory must be outside the repository"
    );
  console.log(`isolated acceptance directory: ${realTemp}`);
  return temp;
}

async function main(): Promise<void> {
  const expectedId = Number(process.argv[2]);
  const expectedRevision = process.argv[3];
  if (
    !Number.isSafeInteger(expectedId) ||
    expectedId <= 0 ||
    !expectedRevision ||
    !/^[a-f0-9]{40,64}$/.test(expectedRevision)
  )
    throw new Error("usage: ci-release-online.ts <release-id> <revision>");
  const root = process.cwd();
  assert.equal(revision(), expectedRevision);
  const load = () =>
    v.parse(
      schema,
      JSON.parse(
        gh([`${repo}/releases/tags/skills-latest`]).toString()
      ) as unknown
    );
  const release = load();
  assert.equal(release.id, expectedId);
  const target =
    process.platform === "win32" && process.arch === "x64"
      ? "x86_64-pc-windows-msvc"
      : process.platform === "linux" && process.arch === "x64"
        ? "x86_64-unknown-linux-gnu"
        : "unsupported";
  if (target === "unsupported")
    throw new Error("unsupported acceptance platform");
  const names = [
    "skill-release-manifest.json",
    "record-native-installer.zip",
    ...nativeRoles.flatMap((role) => [
      `${role}-native.zip`,
      `${role}-0.2.0-${target}.zip`
    ])
  ];
  const assets = downloadReleaseAssets(release, names);
  const temp = await createAcceptanceDirectory(root);
  await unpack(assets.get("record-native-installer.zip")!, temp);
  const bootstrap = path.join(temp, "record-native-installer");
  command(
    "pnpm",
    [
      "install",
      "--prod",
      "--frozen-lockfile",
      "--ignore-workspace",
      "--config.node-linker=isolated"
    ],
    bootstrap
  );
  const old = await legacyTargets(
    root,
    temp,
    await captureNativeCandidateSnapshot(root)
  );
  for (const role of nativeRoles) {
    for (const [kind, destination] of [
      ["legacy", old[role]],
      ["fresh", path.join(temp, `fresh-${role}`)]
    ] as const) {
      await verifyInstallation(role, kind, destination, bootstrap, temp);
    }
  }
  const after = load();
  assert.equal(after.id, release.id);
  assert.equal(revision(), expectedRevision);
  for (const item of release.assets.filter((entry) =>
    names.includes(entry.name)
  ))
    assert.deepEqual(
      after.assets.find((entry) => entry.id === item.id),
      item
    );
  await fs.rm(temp, { recursive: true });
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
