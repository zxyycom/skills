import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { cargoTestId } from "./snapshot/snapshot-cargo.ts";

const declaration = v.strictObject({
  locator: v.pipe(v.string(), v.minLength(1)),
  platform: v.picklist(["unix", "windows"])
});
const registry = v.strictObject({
  version: v.literal(2),
  entities: v.array(declaration)
});
type PlatformEntity = Readonly<
  v.InferOutput<typeof declaration> & { id: string }
>;

export async function readPlatformEntities(
  root: string
): Promise<readonly PlatformEntity[]> {
  const file = path.join(root, "scripts/test-evidence/platform-entities.json");
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
  const parsed = v.parse(registry, JSON.parse(text));
  const ids = new Set<string>();
  return parsed.entities.map((entry) => {
    const match = /^cargo:(lib|bin|test):([^ ]+) > (.+)$/u.exec(entry.locator);
    if (!match?.[1] || !match[2] || !match[3])
      throw new Error("invalid platform entity locator: " + entry.locator);
    const id = cargoTestId(match[1] + "\0" + match[2], match[3]);
    if (ids.has(id))
      throw new Error(
        "duplicate platform entity declaration: " + entry.locator
      );
    ids.add(id);
    return { ...entry, id };
  });
}

export function classifyPlatformReferences(
  entries: readonly PlatformEntity[],
  current: string,
  observed: ReadonlySet<string>,
  missing: readonly string[]
): {
  unavailable: string[];
  invalid: string[];
  stale: PlatformEntity[];
  unexpected: PlatformEntity[];
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
      .sort((left, right) => left.id.localeCompare(right.id)),
    stale: entries
      .filter(
        (entry) =>
          currentPlatform !== null &&
          entry.platform === currentPlatform &&
          !observed.has(entry.id)
      )
      .sort((left, right) => left.id.localeCompare(right.id))
  };
}
