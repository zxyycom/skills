/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/location.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/location.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/location.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { access, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { LocatedOptions, Options } from "./arguments.ts";
import { digest } from "./evidence.ts";
import { boundaryFailure, errorCode, failure } from "./failure.ts";
import { isAbsoluteLocalPath, localInput } from "./media-runtime.ts";
import { assertOutsideSkill, type VideoResources } from "./resources.ts";

/** Source path identity is separate from format version and source-currentness checks. */
export async function locateEvidence<T extends Options>(
  options: T,
  resources: VideoResources
): Promise<LocatedOptions<T>> {
  const input =
    options.input === undefined ? undefined : await localInput(options.input);
  if (options.evidenceRoot !== undefined) assertLocal(options.evidenceRoot);
  const output =
    options.output ??
    (input === undefined || options.evidenceRoot === undefined
      ? undefined
      : path.join(options.evidenceRoot, digest(input)));
  if (!output)
    throw failure({
      kind: "input",
      stage: "arguments",
      target: "evidence selection",
      reason: "provide --output or both --input and --evidence-root"
    });
  await assertOutsideSkill(resources, { directory: output, stage: "output" });
  return {
    ...options,
    ...(input === undefined ? {} : { input }),
    output,
    derivedOutput: options.output === undefined
  };
}
function assertLocal(file: string): void {
  if (!isAbsoluteLocalPath(file)) {
    throw failure({
      kind: "input",
      stage: "output",
      target: file,
      reason: "evidence parent must resolve locally (no UNC)"
    });
  }
}
/** Only media writes create the explicitly selected root; leaf overrides never use this. */
export async function createEvidenceParent(
  output: string,
  evidenceRoot?: string
): Promise<void> {
  if (
    evidenceRoot === undefined ||
    path.dirname(output) !== path.normalize(evidenceRoot) ||
    !/^[a-f0-9]{64}$/.test(path.basename(output))
  ) {
    throw failure({
      kind: "program",
      stage: "output",
      target: output,
      reason: "invalid derived evidence location"
    });
  }
  let ancestor = path.dirname(output);
  try {
    while (true) {
      try {
        await access(ancestor);
        break;
      } catch (error) {
        if (errorCode(error) !== "ENOENT") throw error;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw error;
        ancestor = parent;
      }
    }
    assertLocal(await realpath(ancestor));
    await mkdir(path.dirname(output), { recursive: true });
    assertLocal(await realpath(path.dirname(output)));
  } catch (error) {
    throw boundaryFailure(error, {
      stage: "output",
      target: path.dirname(output)
    });
  }
}
