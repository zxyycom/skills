// 在仓库根运行；需先按项目入口准备 .local/record-cli 原生运行时。
// 使用真实 Linux 二进制、合成发布包和全模拟网络；只写并清理本次临时目录。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { zipSync } from "fflate";

const repo = process.cwd();
const { runNativeUpdaterCli } = await import(pathToFileURL(path.join(repo, "tools/skill-updater/src/native/cli.ts")).href);
const { preparedRuntime } = await import(pathToFileURL(path.join(repo, "scripts/lib/record-native/runtime.ts")).href);
const { paths } = await preparedRuntime(repo);
const roles = ["decision-records", "investigation-report"];
const linux = "x86_64-unknown-linux-gnu";
const windows = "x86_64-pc-windows-msvc";
const descriptors = Object.fromEntries(await Promise.all(roles.map(async role => [role, JSON.parse(await fs.readFile(path.join(repo, "skills", role, "native-runtime.json"), "utf8"))])));
const binaries = Object.fromEntries(await Promise.all(roles.map(async role => [role, await fs.readFile(paths[role])])));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
function release(version, broken = false) {
  const payloads = new Map();
  const entries = {};
  const asset = (name, data) => {
    payloads.set(name, data);
    return { name, byteLength: data.length, sha256: digest(data) };
  };
  for (const role of roles) {
    const descriptor = descriptors[role];
    const schema = role === "decision-records" ? "decision-index.schema.json" : "investigation-index.schema.json";
    const members = {
      [role + "/SKILL.md"]: Buffer.from("---\nname: " + role + "\nmetadata:\n  version: \"" + version + "\"\n---\n"),
      [role + "/native-runtime.json"]: Buffer.from(JSON.stringify(descriptor)),
      [role + "/references/" + schema]: Buffer.from("{}"),
      [role + "/scripts/update-skill.ts"]: Buffer.from(broken ? 'throw new Error("intentional final-path updater failure");' : 'console.log("current updater help");'),
      [role + "/marker"]: Buffer.from("release-" + version)
    };
    const packageZip = Buffer.from(zipSync(members));
    const runtimeZip = Buffer.from(zipSync({ [role]: binaries[role] }));
    const windowsFixture = Buffer.from(zipSync({ [role + ".exe"]: Buffer.from("unexecuted Windows fixture") }));
    entries[role] = {
      version,
      native: {
        schemaVersion: 1,
        runtimeVersion: descriptor.runtimeVersion,
        sourceHash: descriptor.sourceHash,
        package: asset(role + "-native.zip", packageZip),
        targets: {
          [linux]: asset(role + "-" + descriptor.runtimeVersion + "-" + linux + ".zip", runtimeZip),
          [windows]: asset(role + "-" + descriptor.runtimeVersion + "-" + windows + ".zip", windowsFixture)
        },
        bootstrap: asset("record-native-installer.zip", Buffer.from("unused installer fixture"))
      }
    };
  }
  payloads.set("skill-release-manifest.json", Buffer.from(JSON.stringify({ schemaVersion: 1, skills: entries })));
  const assets = [...payloads.keys()].map((name, i) => ({ name, url: "https://api.github.com/repos/fixture/skills/releases/assets/" + (i + 1) }));
  return { payloads, assets };
}
async function snapshot(root) {
  const result = {};
  async function walk(dir, prefix = "") {
    for (const name of (await fs.readdir(dir)).sort()) {
      const relative = prefix + name;
      const full = path.join(dir, name);
      const info = await fs.lstat(full);
      if (info.isDirectory()) await walk(full, relative + "/");
      else result[relative] = { digest: digest(await fs.readFile(full)), mode: info.mode & 0o777 };
    }
  }
  await walk(root);
  return result;
}
const a = release(200), b = release(201), bad = release(202, true);
let selected = a;
const requests = [];
const originalFetch = globalThis.fetch, originalToken = process.env.GITHUB_TOKEN;
const originalLog = console.log, originalError = console.error;
const output = [];
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "receiptless-independent-"));
const results = [];
try {
  process.env.GITHUB_TOKEN = "fixture-token";
  console.log = (...values) => output.push(values.map(String).join(" "));
  console.error = (...values) => output.push(values.map(String).join(" "));
  globalThis.fetch = async request => {
    const url = typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
    if (url === "https://api.github.com/repos/fixture/skills/releases/latest") {
      requests.push("release");
      return Response.json({ tag_name: "fixture", html_url: "https://github.com/fixture/skills/releases/tag/fixture", assets: selected.assets });
    }
    const item = selected.assets.find(item => item.url === url);
    assert.ok(item, "unexpected network access: " + url);
    requests.push(item.name);
    return new Response(selected.payloads.get(item.name));
  };
  for (const role of roles) {
    const original = path.join(scratch, "original", role), moved = path.join(scratch, "moved", role);
    await fs.mkdir(path.dirname(original), { recursive: true });
    await fs.mkdir(path.dirname(moved), { recursive: true });
    const config = { repo: "fixture/skills", skillName: role, releaseAssetName: role + "-native.zip", releaseManifestAssetName: "skill-release-manifest.json", sourcePath: "skills/" + role };
    const run = (target, args = [], bootstrap = false) => runNativeUpdaterCli(config, role, import.meta.url, ["--target-dir", target, ...args], bootstrap);
    selected = a;
    assert.equal(await run(original, ["--yes"], true), 0);
    assert.equal(await fs.readFile(path.join(original, "marker"), "utf8"), "release-200");
    await assert.rejects(fs.lstat(path.join(original, ".record-native-receipt.json")), { code: "ENOENT" });
    await assert.rejects(fs.lstat(path.join(original, ".record-native-evidence")), { code: "ENOENT" });
    await fs.writeFile(path.join(original, "sentinel"), "user content");
    const stale = "not JSON; this unrelated local file must never be parsed";
    await fs.writeFile(path.join(original, ".record-native-receipt.json"), stale);
    await fs.mkdir(path.join(original, ".record-native-evidence"));
    await fs.writeFile(path.join(original, ".record-native-evidence", "custom"), "untouched");
    await fs.rename(original, moved);
    selected = b;
    const before = await snapshot(moved);
    requests.length = 0;
    assert.equal(await run(moved, ["--check"]), 1);
    assert.deepEqual(requests, ["release", "skill-release-manifest.json"]);
    assert.deepEqual(await snapshot(moved), before);
    assert.equal(await run(moved, ["--yes"]), 0);
    assert.equal(await fs.readFile(path.join(moved, "marker"), "utf8"), "release-201");
    assert.equal(await fs.readFile(path.join(moved, ".record-native-receipt.json"), "utf8"), stale);
    assert.equal(await fs.readFile(path.join(moved, "sentinel"), "utf8"), "user content");
    assert.equal(await fs.readFile(path.join(moved, ".record-native-evidence", "custom"), "utf8"), "untouched");
    await fs.writeFile(path.join(moved, "bin", role), "damaged binary");
    requests.length = 0;
    assert.equal(await run(moved, ["--check"]), 0);
    assert.deepEqual(requests, ["release", "skill-release-manifest.json"]);
    assert.equal(await run(moved, ["--yes"], true), 0);
    assert.equal(digest(await fs.readFile(path.join(moved, "bin", role))), digest(binaries[role]));
    assert.equal((await fs.stat(path.join(moved, "bin", role))).mode & 0o777, 0o755);
    const stable = await snapshot(moved);
    selected = bad;
    await assert.rejects(() => run(moved, ["--yes"]), /prepared updater --help failed/);
    assert.deepEqual(await snapshot(moved), stable);
    assert.deepEqual((await fs.readdir(path.dirname(moved))).filter(name => name.startsWith(".")), []);
    selected = b;
    const declined = path.join(scratch, "declined-" + role);
    assert.equal(await run(declined, [], true), 1);
    await assert.rejects(fs.lstat(declined), { code: "ENOENT" });
    results.push({ role, fresh: "real Linux binary validated", movedUpgrade: "200 -> 201", oldMetadata: "ignored and preserved", check: "manifest only; zero writes", reinstall: "same-version binary restored", validationFailure: "all prior bytes and modes restored", declined: "zero target writes" });
  }
} finally {
  console.log = originalLog; console.error = originalError;
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = originalToken;
  await fs.rm(scratch, { recursive: true, force: true });
}
console.log(JSON.stringify({ network: "all responses mocked", nativePlatform: "Linux x64", results }, null, 2));
