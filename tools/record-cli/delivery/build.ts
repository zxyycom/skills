import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { assetName, hostTarget, parseManifest, sha256 } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";

const crate = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.resolve(crate, "../../dist");

function command(commandName: string, args: string[], cwd: string): string {
  const result = spawnSync(commandName, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${commandName} ${args.join(" ")} failed: ${result.error?.message ?? result.stderr}`
    );
  return result.stdout.trim();
}

async function snapshot(
  source: string,
  destination: string,
  relative = ""
): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of (await readdir(source)).sort()) {
    if (!relative && (entry === "target" || entry === "delivery")) continue;
    const from = path.join(source, entry);
    const to = path.join(destination, entry);
    const stat = await lstat(from);
    if (stat.isSymbolicLink()) throw new Error(`symlink in source: ${from}`);
    if (stat.isDirectory())
      await snapshot(from, to, path.join(relative, entry));
    else if (stat.isFile()) await copyFile(from, to);
    else throw new Error(`special source file: ${from}`);
  }
}

export async function treeDigest(
  directory: string
): Promise<{ sha256: string; files: string[] }> {
  const files: string[] = [];
  async function visit(base: string, relative: string): Promise<void> {
    for (const entry of (await readdir(base)).sort()) {
      const current = path.join(base, entry);
      const name = relative ? `${relative}/${entry}` : entry;
      const stat = await lstat(current);
      if (stat.isSymbolicLink())
        throw new Error(`symlink in snapshot: ${name}`);
      if (stat.isDirectory()) await visit(current, name);
      else if (stat.isFile()) files.push(name);
      else throw new Error(`special snapshot member: ${name}`);
    }
  }
  await visit(directory, "");
  files.sort();
  const hash = createHash("sha256");
  for (const name of files) {
    const bytes = await readFile(path.join(directory, ...name.split("/")));
    hash
      .update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`)
      .update(bytes);
  }
  return { sha256: hash.digest("hex"), files };
}

export async function validateBuildEnvironment(
  outputDirectory = outputRoot
): Promise<void> {
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (
      (key.startsWith("CARGO_") && key !== "CARGO_HOME") ||
      (key.startsWith("RUST") &&
        !["RUSTUP_HOME", "RUSTUP_TOOLCHAIN"].includes(key)) ||
      /^(CC|CXX|CFLAGS|CXXFLAGS|LDFLAGS|AR|PKG_CONFIG)(_|$)/.test(key)
    )
      throw new Error(`unsupported build environment: ${key}`);
  }
  if (process.env.RUSTUP_TOOLCHAIN && process.env.RUSTUP_TOOLCHAIN !== "1.98.1")
    throw new Error("Rust toolchain override differs from pinned version");
  await validateCargoConfig(outputDirectory);
}

async function validateCargoConfig(outputDirectory: string): Promise<void> {
  const cargoHome = process.env.CARGO_HOME ?? path.join(os.homedir(), ".cargo");
  let ancestor = outputDirectory;
  const configs = [
    path.join(cargoHome, "config"),
    path.join(cargoHome, "config.toml")
  ];
  while (true) {
    configs.push(
      path.join(ancestor, ".cargo", "config"),
      path.join(ancestor, ".cargo", "config.toml")
    );
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  for (const config of configs) {
    try {
      await lstat(config);
      throw new Error(`Cargo configuration requires review: ${config}`);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
  }
}

export async function validateSnapshot(
  source: string
): Promise<{ sha256: string; files: string[] }> {
  const cargoToml = await readFile(path.join(source, "Cargo.toml"), "utf8");
  if (/\bpath\s*=|\bbuild\s*=|\[workspace\]/.test(cargoToml))
    throw new Error(
      "external paths, build scripts and workspaces require source-closure review"
    );
  const before = await treeDigest(source);
  if (
    before.files.some(
      (file) =>
        file === "build.rs" ||
        file.split("/").includes(".cargo") ||
        file.endsWith("/Cargo.toml")
    )
  )
    throw new Error(
      "build scripts or Cargo config require source-closure review"
    );
  return before;
}

function createManifest(
  version: string,
  target: ReturnType<typeof hostTarget>,
  sourceHash: string,
  rustc: string,
  cargo: string
) {
  return parseManifest({
    schemaVersion: 1,
    version,
    target,
    source: { sha256: sourceHash, rustc, cargo },
    assets: [
      {
        role: "decision-records",
        file: assetName("decision-records", target),
        size: 1,
        sha256: "0".repeat(64)
      },
      {
        role: "investigation-report",
        file: assetName("investigation-report", target),
        size: 1,
        sha256: "0".repeat(64)
      }
    ]
  });
}

async function writeAssets(
  output: string,
  assetsDir: string,
  target: ReturnType<typeof hostTarget>,
  preliminary: Manifest,
  before: { sha256: string; files: string[] }
): Promise<void> {
  await mkdir(assetsDir);
  const assets = [];
  for (const item of preliminary.assets) {
    const executable = path.join(
      output,
      "target",
      target,
      "release",
      item.file
    );
    const observedVersion = command(executable, ["--version"], output);
    if (observedVersion !== `${item.role} ${preliminary.version}`)
      throw new Error(`built binary version mismatch: ${item.role}`);
    const bytes = await readFile(executable);
    await writeFile(path.join(assetsDir, item.file), bytes, {
      flag: "wx",
      mode: 0o755
    });
    assets.push({ ...item, size: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = parseManifest({ ...preliminary, assets });
  await writeFile(
    path.join(assetsDir, "record-cli-candidate.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" }
  );
  await writeFile(
    path.join(output, "source-files.json"),
    `${JSON.stringify(before, null, 2)}\n`,
    { flag: "wx" }
  );
}

export function validateToolchain(source: string): {
  rustc: string;
  cargo: string;
} {
  const rustc = command("rustc", ["-Vv"], source);
  const cargo = command("cargo", ["-V"], source);
  if (!rustc.startsWith("rustc 1.98.1 ") || !cargo.startsWith("cargo 1.98.1 "))
    throw new Error("installed Rust and Cargo do not match pinned 1.98.1");
  return { rustc, cargo };
}

async function prepareSuccessor(source: string): Promise<void> {
  for (const [file, original, replacement] of [
    [
      "Cargo.toml",
      '[package]\nname = "record-cli"\nversion = "0.1.0"',
      '[package]\nname = "record-cli"\nversion = "0.1.1"'
    ],
    [
      "Cargo.lock",
      'name = "record-cli"\nversion = "0.1.0"',
      'name = "record-cli"\nversion = "0.1.1"'
    ]
  ]) {
    const filename = path.join(source, file);
    const text = await readFile(filename, "utf8");
    if (text.split(original).length !== 2)
      throw new Error(`unexpected private successor input: ${file}`);
    await writeFile(filename, text.replace(original, replacement));
  }
}

export async function buildAndVerifySnapshot(
  source: string,
  output: string,
  target: ReturnType<typeof hostTarget>,
  sourceHash: string
): Promise<void> {
  command(
    "cargo",
    [
      "build",
      "--release",
      "--locked",
      "--offline",
      "--target",
      target,
      "--target-dir",
      path.join(output, "target")
    ],
    source
  );
  if ((await treeDigest(source)).sha256 !== sourceHash)
    throw new Error("source snapshot changed during build");
}

/** Creates a new ignored candidate directory; never overwrites an existing build. */
export async function buildCandidate(
  name: string,
  version: string,
  predecessorSource?: string
): Promise<string> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
    throw new Error("invalid candidate name");
  await validateBuildEnvironment();
  const target = hostTarget();
  await mkdir(outputRoot, { recursive: true });
  if ((await realpath(outputRoot)) !== outputRoot)
    throw new Error("dist must not be a symlink");
  const output = path.join(outputRoot, name);
  await mkdir(output); // exclusive: no implicit overwrite or cleanup
  const source = path.join(output, "source");
  const assetsDir = path.join(output, "assets");
  await snapshot(predecessorSource ?? crate, source);
  if (predecessorSource) {
    if (version !== "0.1.1") throw new Error("private successor must be 0.1.1");
    await prepareSuccessor(source);
  }
  const before = await validateSnapshot(source);
  const { rustc, cargo } = validateToolchain(source);
  const preliminary = createManifest(
    version,
    target,
    before.sha256,
    rustc,
    cargo
  );
  await buildAndVerifySnapshot(source, output, target, before.sha256);
  await writeAssets(output, assetsDir, target, preliminary, before);
  return assetsDir;
}
