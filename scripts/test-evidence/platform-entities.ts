import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { assertRuntimeDirectory } from "../lib/record-native/runtime.ts";

const declaration = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^test:[0-9a-f]{64}$/u)),
  locator: v.pipe(v.string(), v.minLength(1)),
  platform: v.picklist(["unix", "windows"])
});
const registry = v.strictObject({
  version: v.literal(1),
  sourceHash: v.nullable(v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u))),
  entities: v.array(declaration)
});
export type PlatformEntity = v.InferOutput<typeof declaration>;

async function readPlatformRegistry(
  root: string
): Promise<v.InferOutput<typeof registry> | null> {
  const file = path.join(root, "scripts/test-evidence/platform-entities.json");
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return v.parse(registry, JSON.parse(text));
}

async function verifyPlatformSource(
  root: string,
  sourceHash: string | null
): Promise<void> {
  if (sourceHash === null)
    throw new Error(
      "platform entity sourceHash is pending; enumerate both platforms before approval"
    );
  const actual = await cargoSourceFingerprint(
    path.join(root, "tools/record-cli")
  );
  if (actual !== sourceHash)
    throw new Error(
      "platform entity sourceHash mismatch; re-enumerate both platforms before approval"
    );
}

function validatePlatformDeclarations(
  entries: readonly PlatformEntity[]
): void {
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
    throw new Error("duplicate platform entity declaration");
  for (const entry of entries) {
    const match = /^cargo:(lib|test):([^ ]+) > (.+)$/u.exec(entry.locator);
    if (!match)
      throw new Error("invalid platform entity locator: " + entry.locator);
    const [, kind, target, name] = match;
    const digest = createHash("sha256")
      .update(
        JSON.stringify(["cargo", "record-cli", kind + "\0" + target, name])
      )
      .digest("hex");
    if (entry.id !== "test:" + digest)
      throw new Error("platform entity identity mismatch: " + entry.locator);
  }
}

export async function readPlatformEntityProof(
  root: string
): Promise<{ entities: readonly PlatformEntity[]; sourceHash: string | null }> {
  const parsed = await readPlatformRegistry(root);
  if (parsed === null) return { entities: [], sourceHash: null };
  const entries = parsed.entities;
  if (entries.length) await verifyPlatformSource(root, parsed.sourceHash);
  validatePlatformDeclarations(entries);
  return {
    entities: entries,
    sourceHash: entries.length ? parsed.sourceHash : null
  };
}

export async function readPlatformEntities(
  root: string
): Promise<readonly PlatformEntity[]> {
  return (await readPlatformEntityProof(root)).entities;
}

export function classifyPlatformReferences(
  entries: readonly PlatformEntity[],
  current: string,
  observed: ReadonlySet<string>,
  missing: readonly string[]
): {
  unavailable: string[];
  invalid: string[];
  stale: string[];
  unexpected: string[];
} {
  const currentPlatform =
    current === "win32"
      ? "windows"
      : current === "linux" || current === "darwin"
        ? "unix"
        : null;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const unavailable = [
    ...new Set(
      missing.filter((id) => {
        const entry = byId.get(id);
        return (
          currentPlatform !== null &&
          entry !== undefined &&
          entry.platform !== currentPlatform &&
          !observed.has(id)
        );
      })
    )
  ].sort();
  const unavailableSet = new Set(unavailable);
  return {
    unavailable,
    invalid: [
      ...new Set(missing.filter((id) => !unavailableSet.has(id)))
    ].sort(),
    unexpected: entries
      .filter(
        (entry) =>
          currentPlatform !== null &&
          entry.platform !== currentPlatform &&
          observed.has(entry.id)
      )
      .map((entry) => entry.id)
      .sort(),
    stale: entries
      .filter(
        (entry) =>
          currentPlatform !== null &&
          entry.platform === currentPlatform &&
          !observed.has(entry.id)
      )
      .map((entry) => entry.id)
      .sort()
  };
}

/** Same file closure as workingSourceDigest; normalize CRLF only in valid UTF-8 text. */
export async function cargoSourceFingerprint(
  directory: string
): Promise<string> {
  await assertRuntimeDirectory(directory);
  const files: { path: string; data: Buffer }[] = [];
  async function visit(dir: string, prefix: string): Promise<void> {
    for (const name of (await fs.readdir(dir)).sort()) {
      if (!prefix && (name === "target" || name === "delivery")) continue;
      const relative = prefix ? `${prefix}/${name}` : name;
      const current = path.join(dir, name);
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink())
        throw new Error(`symlink in Cargo source: ${relative}`);
      if (stat.isDirectory()) await visit(current, relative);
      else if (stat.isFile()) {
        const bytes = await fs.readFile(current);
        let data = bytes;
        if (!bytes.includes(0)) {
          try {
            const text = new TextDecoder("utf-8", {
              fatal: true,
              ignoreBOM: true
            }).decode(bytes);
            data = Buffer.from(text.replaceAll("\r\n", "\n"));
          } catch {
            /* Non-UTF8 input is hashed as raw bytes. */
          }
        }
        files.push({ path: relative, data });
      } else throw new Error(`special Cargo source: ${relative}`);
    }
  }
  await visit(directory, "");
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hash = createHash("sha256");
  for (const file of files)
    hash
      .update(
        `${Buffer.byteLength(file.path)}:${file.path}:${file.data.length}:`
      )
      .update(file.data);
  return hash.digest("hex");
}
