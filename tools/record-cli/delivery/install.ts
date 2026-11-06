import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
  chmod
} from "node:fs/promises";
import path from "node:path";
import { hostTarget, parseManifest, sha256 } from "./manifest.ts";

const marker = ".record-cli-fixture";
const metadata = "record-cli-candidate.json";

async function regularFile(file: string): Promise<Buffer> {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(`not a regular file: ${file}`);
  return readFile(file);
}

async function checkedDirectory(directory: string): Promise<string> {
  const absolute = path.resolve(directory);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(`unsafe directory: ${current}`);
  }
  return absolute;
}

interface ExistingFile {
  readonly bytes: Buffer;
  readonly mode: number;
}

async function existingFile(file: string): Promise<ExistingFile | undefined> {
  try {
    const bytes = await regularFile(file);
    const stat = await lstat(file);
    return { bytes, mode: stat.mode & 0o777 };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  }
}

export interface InstallOptions {
  readonly source: string;
  readonly destination: string;
  readonly version: string;
  /** Test-only failure point after the specified number of actual replacements. */
  readonly failAfter?: number;
  readonly onPlan?: (
    entries: readonly { name: string; overwrite: boolean }[]
  ) => void;
}

async function validateFixture(
  source: string,
  destination: string
): Promise<void> {
  const relative = path.relative(source, destination);
  const inverse = path.relative(destination, source);
  if (
    !relative ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..") ||
    (!inverse.startsWith(`..${path.sep}`) && inverse !== "..")
  ) {
    throw new Error("source and destination overlap");
  }
  if (
    (await regularFile(path.join(destination, marker))).toString("utf8") !==
    "record-cli private fixture\n"
  ) {
    throw new Error("destination is not a private fixture");
  }
}

async function loadAssets(
  source: string,
  version: string
): Promise<Map<string, Buffer>> {
  const manifestBytes = await regularFile(path.join(source, metadata));
  const manifest = parseManifest(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)
    ) as unknown
  );
  if (manifest.version !== version || manifest.target !== hostTarget())
    throw new Error("version or host target mismatch");
  const expectedNames = [
    metadata,
    ...manifest.assets.map((item) => item.file)
  ].sort();
  if (
    JSON.stringify((await readdir(source)).sort()) !==
    JSON.stringify(expectedNames)
  )
    throw new Error("unexpected or missing asset directory members");
  const contents = new Map<string, Buffer>();
  for (const item of manifest.assets) {
    const bytes = await regularFile(path.join(source, item.file));
    if (bytes.length !== item.size || sha256(bytes) !== item.sha256)
      throw new Error(`asset integrity mismatch: ${item.file}`);
    contents.set(item.file, bytes);
  }
  contents.set(metadata, manifestBytes);
  return contents;
}

/** Installs only into an explicitly marked private fixture, never a real skill. */
export async function installCandidate(
  options: InstallOptions
): Promise<readonly string[]> {
  const source = await checkedDirectory(options.source);
  const destination = await checkedDirectory(options.destination);
  await validateFixture(source, destination);
  const contents = await loadAssets(source, options.version);
  const originals = new Map<string, ExistingFile | undefined>();
  for (const name of contents.keys())
    originals.set(name, await existingFile(path.join(destination, name)));
  options.onPlan?.(
    [...originals].map(([name, value]) => ({
      name,
      overwrite: value !== undefined
    }))
  );
  const staging = await mkdtemp(path.join(destination, ".record-cli-stage-"));
  const written: string[] = [];
  try {
    for (const [name, bytes] of contents) {
      const staged = path.join(staging, name);
      await writeFile(staged, bytes, {
        flag: "wx",
        mode: name === metadata ? 0o600 : 0o755
      });
      if (!(await regularFile(staged)).equals(bytes))
        throw new Error(`staged readback mismatch: ${name}`);
    }
    for (const [name, bytes] of contents) {
      const target = path.join(destination, name);
      const before = originals.get(name);
      const current = await existingFile(target);
      if (
        (before === undefined) !== (current === undefined) ||
        (before &&
          current &&
          (!before.bytes.equals(current.bytes) || before.mode !== current.mode))
      )
        throw new Error(`target changed: ${name}`);
      // Backups are kept in staging until every write and independent readback succeeds.
      if (before !== undefined)
        await writeFile(path.join(staging, `${name}.backup`), before.bytes, {
          flag: "wx",
          mode: before.mode
        });
      if (before !== undefined)
        await chmod(path.join(staging, `${name}.backup`), before.mode);
      await rename(path.join(staging, name), target);
      written.push(name);
      if (name !== metadata) await chmod(target, 0o755);
      if (options.failAfter === written.length)
        throw new Error("injected replacement failure");
      if (!(await regularFile(target)).equals(bytes))
        throw new Error(`installed readback mismatch: ${name}`);
    }
  } catch (error) {
    const failures: string[] = [];
    for (const name of [...written].reverse()) {
      try {
        const target = path.join(destination, name);
        const expected = contents.get(name);
        if (!expected || !(await regularFile(target)).equals(expected))
          throw new Error("target changed after replacement");
        const before = originals.get(name);
        if (before === undefined) await rm(target);
        else await rename(path.join(staging, `${name}.backup`), target);
        const restored = await existingFile(target);
        if (
          (before === undefined) !== (restored === undefined) ||
          (before &&
            restored &&
            (!before.bytes.equals(restored.bytes) ||
              before.mode !== restored.mode))
        )
          throw new Error("restore readback mismatch");
      } catch {
        failures.push(name);
      }
    }
    if (failures.length)
      throw new Error(
        `install failed; recovery incomplete for ${failures.join(", ")}; backups retained at ${staging}`,
        { cause: error }
      );
    await rm(staging, { recursive: true });
    throw new Error(
      `install failed; changes rolled back: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  try {
    await rm(staging, { recursive: true });
  } catch (error) {
    throw new Error(
      `installation committed but cleanup failed; inspect ${staging}`,
      { cause: error }
    );
  }
  return [...contents.keys()];
}
