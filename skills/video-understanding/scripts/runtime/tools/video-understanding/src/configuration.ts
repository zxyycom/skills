/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/configuration.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/configuration.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/configuration.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  boundaryFailure,
  errorCode,
  failure,
  parseJson,
  validate
} from "./failure.ts";
import { isAbsoluteLocalPath } from "./location.ts";
import { assertOutsideSkill, type VideoResources } from "./resources.ts";

const RootSchema = v.optional(
  v.nullable(
    v.pipe(
      v.string(),
      v.check(
        isAbsoluteLocalPath,
        "requires a fully qualified absolute local path (no URL or UNC)"
      ),
      v.transform((value) => path.resolve(value))
    )
  )
);
const ConfigurationSchema = v.pipe(
  v.unknown(),
  v.check(
    (value) =>
      value !== null && typeof value === "object" && !Array.isArray(value),
    "configuration must be a JSON object"
  ),
  v.strictObject({
    appRoot: RootSchema,
    dataRoot: RootSchema
  })
);
type ConfigurationLayer = v.InferOutput<typeof ConfigurationSchema>;
export type LocationConfiguration = Readonly<{
  appRoot: string | null;
  dataRoot: string | null;
}>;

async function readConfigurationLayer(
  target: string,
  required: boolean,
  resources: VideoResources
): Promise<ConfigurationLayer> {
  try {
    if (!isAbsoluteLocalPath(target)) {
      throw failure({
        kind: "input",
        stage: "arguments",
        target,
        reason:
          "configuration requires a fully qualified absolute local path (no URL or UNC)"
      });
    }
    await assertOutsideSkill(resources, {
      directory: target,
      stage: "arguments"
    });
    let text: string;
    try {
      text = await readFile(target, "utf8");
    } catch (error) {
      if (!required && errorCode(error) === "ENOENT") return {};
      throw error;
    }
    const parsed = validate(
      ConfigurationSchema,
      parseJson(text, { stage: "arguments", target }),
      { stage: "arguments", target }
    );
    for (const root of [parsed.appRoot, parsed.dataRoot]) {
      if (root != null)
        await assertOutsideSkill(resources, {
          directory: root,
          stage: "arguments"
        });
    }
    return parsed;
  } catch (error) {
    throw boundaryFailure(error, { stage: "arguments", target });
  }
}

/** Validate each read layer before merging; a higher-priority value cannot hide an invalid file. */
export async function readLocationConfiguration({
  userConfigPath,
  projectConfigPath,
  resources
}: {
  userConfigPath: string;
  projectConfigPath?: string;
  resources: VideoResources;
}): Promise<LocationConfiguration> {
  const user = await readConfigurationLayer(userConfigPath, false, resources);
  const project =
    projectConfigPath === undefined
      ? {}
      : await readConfigurationLayer(projectConfigPath, true, resources);
  return {
    appRoot: project.appRoot ?? user.appRoot ?? null,
    dataRoot: project.dataRoot ?? user.dataRoot ?? null
  };
}
