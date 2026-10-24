/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/resources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/resources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/resources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundaryFailure, errorCode, failure } from "./failure.ts";

export type VideoResources = Readonly<{
  skillRoot: string;
  mediaHelper: string;
  rapidocrHelper: string;
  runtimeEnvironment: string;
  ocrProfiles: string;
}>;

/** The public scripts/video.ts URL owns the package layout, not the copied module depth. */
export function resourcesFromEntry(entryUrl: string | URL): VideoResources {
  const skillRoot = fileURLToPath(new URL("../", entryUrl));
  return {
    skillRoot,
    mediaHelper: path.join(skillRoot, "scripts", "media.py"),
    rapidocrHelper: path.join(skillRoot, "scripts", "rapidocr.py"),
    runtimeEnvironment: path.join(skillRoot, "scripts", "runtime.env"),
    ocrProfiles: path.join(skillRoot, "runtime", "ocr-profiles.json")
  };
}

async function physicalPath(directory: string): Promise<string> {
  let ancestor = directory;
  const missing: string[] = [];
  while (true) {
    try {
      return path.resolve(await realpath(ancestor), ...missing.toReversed());
    } catch (error) {
      const parent = path.dirname(ancestor);
      if (errorCode(error) !== "ENOENT" || parent === ancestor) throw error;
      missing.push(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

/** Resolve existing ancestors without creating a path or requiring a media installation. */
export async function assertOutsideSkill(
  resources: VideoResources,
  {
    directory,
    stage
  }: {
    directory: string;
    stage: "arguments" | "output" | "runtime";
  }
): Promise<void> {
  try {
    const skillRoot = await realpath(resources.skillRoot);
    const resolved = await physicalPath(directory);
    if (resolved.startsWith("\\\\") || resolved.startsWith("//")) {
      throw failure({
        kind: "input",
        stage,
        target: directory,
        reason: "resolved path must remain local (no UNC)"
      });
    }
    const relative = path.relative(skillRoot, resolved);
    if (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    ) {
      throw failure(
        {
          kind: "input",
          stage,
          target: directory,
          reason:
            "configuration, evidence and media runtime paths must remain outside the skill installation"
        },
        "choose an external configuration, evidence/output or media runtime path; do not write runtime data into the skill package"
      );
    }
  } catch (error) {
    throw boundaryFailure(error, { stage, target: directory });
  }
}
