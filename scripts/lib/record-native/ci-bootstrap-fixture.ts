import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  nativeRoles,
  type NativeRole
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { NativeCandidateSnapshot } from "./capture.ts";
import { command, hash } from "./ci-bootstrap-process.ts";

const legacySchema = v.object({
  sourceRevision: v.literal("dc874213f494ba5411330afe135c0542df5184a8"),
  skills: v.record(
    v.string(),
    v.object({
      files: v.record(
        v.string(),
        v.object({ byteLength: v.number(), sha256: v.string() })
      )
    })
  )
});

export function extractLegacyTar(
  archive: Uint8Array,
  destination: string
): void {
  command("tar", ["-xf", "-"], destination, archive);
}

export async function legacyTargets(
  root: string,
  temp: string,
  snapshot: NativeCandidateSnapshot
): Promise<Record<NativeRole, string>> {
  const source = snapshot.delivery.find(
    (file) =>
      file.path === "tools/skill-updater/src/native/legacy-manifests.json"
  );
  if (!source) throw new Error("frozen legacy manifest missing");
  const manifest = v.parse(
    legacySchema,
    JSON.parse(source.data.toString("utf8")) as unknown
  );
  const archive = command(
    "git",
    [
      "archive",
      manifest.sourceRevision,
      ...nativeRoles.map((role) => `skills/${role}`)
    ],
    root
  );
  extractLegacyTar(archive, temp);
  const destinations = {} as Record<NativeRole, string>;
  for (const role of nativeRoles) {
    const destination = path.join(temp, "skills", role);
    const files = manifest.skills[role]?.files;
    if (!files) throw new Error(`legacy files missing: ${role}`);
    const gitFiles = command(
      "git",
      [
        "ls-tree",
        "-r",
        "--name-only",
        manifest.sourceRevision,
        `skills/${role}`
      ],
      root
    )
      .toString("utf8")
      .trimEnd()
      .split("\n")
      .map((name) => name.slice(`skills/${role}/`.length))
      .sort();
    if (JSON.stringify(gitFiles) !== JSON.stringify(Object.keys(files).sort()))
      throw new Error(`historical legacy file set differs: ${role}`);
    for (const [name, expected] of Object.entries(files)) {
      const bytes = await fs.readFile(
        path.join(destination, ...name.split("/"))
      );
      if (
        bytes.length !== expected.byteLength ||
        hash(bytes) !== expected.sha256
      )
        throw new Error(`historical legacy mismatch: ${role}/${name}`);
    }
    destinations[role] = destination;
  }
  return destinations;
}
