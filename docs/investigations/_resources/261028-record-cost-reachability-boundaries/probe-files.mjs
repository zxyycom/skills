import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { readSelectedFile as baseline } from "./baseline/tools/shared/src/file-text-search/files.ts";
const base = path.dirname(new URL(import.meta.url).pathname);
function replaceOnce(source, marker, replacement) {
  assert.equal(
    source.split(marker).length,
    2,
    `expected one source marker: ${marker}`
  );
  return source.replace(marker, replacement);
}
let code = await fs.readFile(
  path.join(base, "baseline/tools/shared/src/file-text-search/files.ts"),
  "utf8"
);
code = replaceOnce(
  code,
  "let current = root;\n  for (const segment of segments)",
  "let current = root;\n  let entry;\n  for (const segment of segments)"
);
code = replaceOnce(
  code,
  "    const entry = await lstatSelectedPath(current, sourcePath);",
  "    entry = await lstatSelectedPath(current, sourcePath);"
);
code = replaceOnce(
  code,
  "  const entry = await lstatSelectedPath(current, sourcePath);\n  if (!entry.isFile())",
  "  if (!entry.isFile())"
);
await fs.writeFile(
  path.join(
    base,
    "instrumented/tools/shared/src/file-text-search/files-collapsed.ts"
  ),
  code
);
const { readSelectedFile: candidate } =
  await import("./instrumented/tools/shared/src/file-text-search/files-collapsed.ts");
const limits = {
  maxCandidateFiles: 10,
  maxFileBytes: 10000,
  maxTotalBytes: 10000
};
const results = [];
for (const [variant, read] of [
  ["baseline", baseline],
  ["collapsed", candidate]
])
  for (const attack of [
    "stable",
    "transient-leaf-symlink",
    "opened-replacement"
  ]) {
    const root = await fs.mkdtemp(
      path.join(base, `files-${variant}-${attack}-`)
    );
    const target = path.join(root, "leaf.txt");
    const other = path.join(root, "other.txt");
    await fs.writeFile(target, "original");
    await fs.writeFile(other, "replacement");
    const lstat = fs.lstat,
      realpath = fs.realpath,
      open = fs.open;
    let leafLstats = 0;
    let swapped = false;
    fs.lstat = async function (file, ...args) {
      const value = await lstat(file, ...args);
      if (String(file) === target) {
        leafLstats++;
        if (attack === "transient-leaf-symlink" && leafLstats === 1) {
          await fs.rename(target, target + ".saved");
          await fs.symlink(other, target);
          swapped = true;
        }
      }
      return value;
    };
    fs.realpath = async function (file, ...args) {
      const value = await realpath(file, ...args);
      if (
        attack === "transient-leaf-symlink" &&
        String(file) === target &&
        swapped
      ) {
        await fs.unlink(target);
        await fs.rename(target + ".saved", target);
        swapped = false;
      }
      return value;
    };
    fs.open = async function (file, ...args) {
      const handle = await open(file, ...args);
      if (attack === "opened-replacement" && String(file) === target) {
        await fs.rename(target, target + ".opened");
        await fs.copyFile(other, target);
      }
      return handle;
    };
    let result;
    try {
      result = { status: "ok", value: await read(root, "leaf.txt", limits, 0) };
    } catch (e) {
      result = { status: "error", code: e.code, message: e.message };
    } finally {
      fs.lstat = lstat;
      fs.realpath = realpath;
      fs.open = open;
    }
    results.push({ variant, attack, leafLstats, result, root });
  }
assert.equal(
  results.find(
    (r) => r.variant === "baseline" && r.attack === "transient-leaf-symlink"
  ).result.status,
  "error"
);
assert.equal(
  results.find(
    (r) => r.variant === "collapsed" && r.attack === "transient-leaf-symlink"
  ).result.status,
  "ok"
);
assert.equal(
  results.find(
    (r) => r.variant === "collapsed" && r.attack === "opened-replacement"
  ).result.status,
  "error"
);
await fs.writeFile(
  path.join(base, "files-results.json"),
  JSON.stringify(results, null, 2)
);
console.log(JSON.stringify(results, null, 2));
