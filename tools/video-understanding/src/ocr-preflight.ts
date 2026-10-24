import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { boundaryFailure, failure, parseJson, validate } from "./failure.ts";
import type { VideoResources } from "./resources.ts";

const HashSchema = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const FileSchema = v.object({
  path: v.pipe(v.string(), v.minLength(1)),
  sha256: HashSchema
});
const InstallationSchema = v.object({
  tool: v.picklist(["videocr", "rapidocr"]),
  version: v.string(),
  profile: v.string(),
  program: v.string(),
  models: v.pipe(v.array(FileSchema), v.minLength(1)),
  dependencies: v.optional(v.array(v.unknown()))
});
export type OcrProvenance = {
  tool: string;
  version: string;
  profile: string;
  models: { path: string; sha256: string }[];
};
const profiles = {
  videocr: {
    version: "1.6.0",
    profile: "windows-x64-cpu-paddle-ppocrv6-small-ch"
  },
  rapidocr: {
    version: "3.10.0",
    profile: "windows-x64-cpu-onnx-ppocrv6-small-ppocrv4-cls"
  }
};
export type OcrTool = keyof typeof profiles;
async function hashFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function installedFile(root: string, relative: string): Promise<string> {
  const segments = relative.split(/[\\/]/);
  if (
    path.isAbsolute(relative) ||
    segments.some((part) => part === ".." || part === "" || part.includes(":"))
  ) {
    throw failure({
      kind: "protocol",
      stage: "runtime",
      target: "installation.json",
      reason: "installed paths must remain relative to the tool slot"
    });
  }
  const file = await realpath(path.join(root, relative));
  const inside = path.relative(await realpath(root), file);
  if (
    inside.startsWith(`..${path.sep}`) ||
    inside === ".." ||
    path.isAbsolute(inside) ||
    !(await stat(file)).isFile()
  ) {
    throw failure({
      kind: "environment",
      stage: "runtime",
      target: file,
      reason: "installed dependency escapes tool slot or is not a file"
    });
  }
  return file;
}
async function verifyInstalledHashes(
  root: string,
  files: v.InferOutput<typeof FileSchema>[],
  tool: "model" | "VideOCR executable"
): Promise<void> {
  for (const entry of files) {
    const file = await installedFile(root, entry.path);
    if ((await hashFile(file)) !== entry.sha256) {
      throw failure({
        kind: "environment",
        stage: "runtime",
        target: file,
        reason: `local ${tool === "model" ? "OCR model" : tool} SHA256 mismatch`
      });
    }
  }
}
async function readInstalledProfile(target: string, tool: OcrTool) {
  const expected = profiles[tool];
  const installed = validate(
    InstallationSchema,
    parseJson(await readFile(target, "utf8"), { stage: "runtime", target }),
    { stage: "runtime", target }
  );
  if (
    installed.tool !== tool ||
    installed.version !== expected.version ||
    installed.profile !== expected.profile
  ) {
    throw failure({
      kind: "environment",
      stage: "runtime",
      target,
      reason: "installed OCR profile mismatch"
    });
  }
  return installed;
}
async function readDeclaredProfiles(resources: VideoResources) {
  const declared = validate(
    v.object({
      rapidocr: v.object({
        program: v.string(),
        models: v.array(FileSchema)
      }),
      videocr: v.object({
        program: v.string(),
        models: v.array(FileSchema),
        executables: v.array(FileSchema)
      })
    }),
    parseJson(await readFile(resources.ocrProfiles, "utf8"), {
      stage: "runtime",
      target: "OCR profiles"
    }),
    { stage: "runtime", target: "OCR profiles" }
  );
  return declared;
}
function verifyModelInventory(
  installed: v.InferOutput<typeof InstallationSchema>,
  declared: { models: v.InferOutput<typeof FileSchema>[] },
  target: string
): void {
  if (
    installed.models.length !== declared.models.length ||
    declared.models.some(
      (model) =>
        !installed.models.some(
          (entry) => entry.path === model.path && entry.sha256 === model.sha256
        )
    )
  ) {
    throw failure({
      kind: "environment",
      stage: "runtime",
      target,
      reason: "fixed OCR model inventory mismatch"
    });
  }
}
export async function ocrPreflight(
  appRoot: string,
  tool: keyof typeof profiles,
  resources: VideoResources
) {
  const expected = profiles[tool];
  const root = path.join(appRoot, "tools", tool, expected.version);
  try {
    const target = path.join(root, "installation.json");
    const installed = await readInstalledProfile(target, tool);
    const program = await installedFile(root, installed.program);
    const declared = await readDeclaredProfiles(resources);
    verifyModelInventory(installed, declared[tool], target);
    await verifyInstalledHashes(root, installed.models, "model");
    if (installed.program !== declared[tool].program)
      throw failure({
        kind: "environment",
        stage: "runtime",
        target,
        reason: "fixed OCR program path mismatch"
      });
    if (tool === "videocr") {
      await verifyInstalledHashes(
        root,
        declared.videocr.executables,
        "VideOCR executable"
      );
    }
    return {
      root,
      program,
      provenance: { tool, ...expected, models: installed.models }
    };
  } catch (error) {
    throw boundaryFailure(error, { stage: "runtime", target: root });
  }
}
