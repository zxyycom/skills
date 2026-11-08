import { spawnSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAndVerifySnapshot,
  treeDigest,
  validateBuildEnvironment,
  validateSnapshot,
  validateToolchain
} from "../tools/record-cli/delivery/build.ts";
import {
  assertRuntimeDirectory,
  digest,
  executableName,
  hostTarget,
  preparedRuntime,
  parseReceipt,
  roles
} from "./lib/record-native/runtime.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "tools", "record-cli");

async function capture(from: string, to: string, top = true): Promise<void> {
  await mkdir(to);
  for (const name of (await readdir(from)).sort()) {
    if (top && (name === "target" || name === "delivery")) continue;
    const input = path.join(from, name);
    const output = path.join(to, name);
    const stat = await lstat(input);
    if (stat.isSymbolicLink()) throw new Error(`symlink in source: ${input}`);
    if (stat.isDirectory()) await capture(input, output, false);
    else if (stat.isFile()) await copyFile(input, output);
    else throw new Error(`special source file: ${input}`);
  }
}
// Use the same source closure as the frozen builder without copying or writing.
export async function workingSourceDigest(directory: string): Promise<string> {
  await assertRuntimeDirectory(directory);
  const files: { path: string; data: Buffer }[] = [];
  async function visit(dir: string, prefix: string): Promise<void> {
    for (const name of (await readdir(dir)).sort()) {
      if (!prefix && (name === "target" || name === "delivery")) continue;
      const relative = prefix ? `${prefix}/${name}` : name;
      const current = path.join(dir, name);
      const stat = await lstat(current);
      if (stat.isSymbolicLink())
        throw new Error(`symlink in source: ${current}`);
      if (stat.isDirectory()) await visit(current, relative);
      else if (stat.isFile())
        files.push({ path: relative, data: await readFile(current) });
      else throw new Error(`special source file: ${current}`);
    }
  }
  await visit(directory, "");
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for (const file of files)
    hash
      .update(
        `${Buffer.byteLength(file.path)}:${file.path}:${file.data.length}:`
      )
      .update(file.data);
  return hash.digest("hex");
}
export async function check(rootDirectory: string): Promise<void> {
  const { receipt } = await preparedRuntime(rootDirectory);
  if (
    (await workingSourceDigest(
      path.join(rootDirectory, "tools", "record-cli")
    )) !== receipt.sourceHash
  )
    throw new Error("native source changed");
}
export async function ensureRuntimeBase(
  rootDirectory: string
): Promise<string> {
  const workspace = path.resolve(rootDirectory);
  await assertRuntimeDirectory(workspace);
  let current = workspace;
  for (const name of [".local", "record-cli"]) {
    current = path.join(current, name);
    try {
      await mkdir(current);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      )
        throw error;
    }
    await assertRuntimeDirectory(current);
  }
  return current;
}

async function currentReceipt(base: string): Promise<Buffer | null> {
  const file = path.join(base, "receipt.json");
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("invalid runtime receipt file");
    const bytes = await readFile(file);
    parseReceipt(JSON.parse(bytes.toString("utf8")) as unknown);
    return bytes;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

async function prepare(): Promise<void> {
  const base = await ensureRuntimeBase(root);
  const originalReceipt = await currentReceipt(base);
  await validateBuildEnvironment(base);
  const target = hostTarget();
  await assertRuntimeDirectory(source);
  const generation = await mkdtemp(path.join(base, "generation-"));
  const frozen = path.join(generation, "source");
  await capture(source, frozen);
  const snapshot = await validateSnapshot(frozen);
  validateToolchain(frozen);
  await buildAndVerifySnapshot(frozen, generation, target, snapshot.sha256);
  if (
    (await workingSourceDigest(source)) !== snapshot.sha256 ||
    (await treeDigest(frozen)).sha256 !== snapshot.sha256
  )
    throw new Error("native source changed during build; rerun prepare");
  const binaries = { "decision-records": "", "investigation-report": "" };
  const cargo = await readFile(path.join(frozen, "Cargo.toml"), "utf8");
  const version = /^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
  if (!version) throw new Error("missing Cargo package version");
  for (const role of roles) {
    const name = executableName(role, target);
    const built = path.join(generation, "target", target, "release", name);
    const run = spawnSync(built, ["--version"], { encoding: "utf8" });
    if (
      run.error ||
      run.status !== 0 ||
      run.stdout.trim() !== `${role} ${version}`
    )
      throw new Error(`binary version mismatch: ${role}`);
    const bytes = await readFile(built);
    await writeFile(path.join(generation, name), bytes, {
      flag: "wx",
      mode: 0o755
    });
    binaries[role] = digest(bytes);
  }
  const receipt = {
    schemaVersion: 1,
    target,
    generation: path.basename(generation),
    sourceHash: snapshot.sha256,
    binaries
  };
  const pending = path.join(generation, "receipt.json");
  await writeFile(pending, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: "wx"
  });
  const freshReceipt = await currentReceipt(base);
  if (
    (originalReceipt === null) !== (freshReceipt === null) ||
    (originalReceipt && freshReceipt && !originalReceipt.equals(freshReceipt))
  )
    throw new Error(
      `runtime receipt changed during prepare; candidate retained at ${generation}`
    );
  await rename(pending, path.join(base, "receipt.json"));
  await check(root);
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length === 3 && process.argv[2] === "--check")
      await check(root);
    else if (process.argv.length === 2) await prepare();
    else throw new Error("usage: prepare-record-native.ts [--check]");
    process.stdout.write("record native runtime ready\n");
  } catch (error) {
    process.stderr.write(
      `record native runtime: ${error instanceof Error ? error.message : String(error)}; run bun run prepare:record-native\n`
    );
    process.exitCode = 1;
  }
}
