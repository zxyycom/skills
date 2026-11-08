import { assertRuntimeDirectory } from "./runtime.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { assertNativeRelativePaths } from "../../../tools/skill-package/src/native-paths.ts";
import { digestNativeSource, type NativeCandidateSnapshot } from "./capture.ts";
import { packSkillPackageSnapshot } from "../skill-package/skill-package-release.ts";

async function ensureOwnedParent(directory: string): Promise<void> {
  try {
    await fs.mkdir(directory);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error(`staging parent must be a regular directory: ${directory}`);
}

/** Write a candidate snapshot to a new owned staging directory, never the dist root. */
export async function stageNativeCandidateInputs(
  workspaceRoot: string,
  snapshot: NativeCandidateSnapshot
): Promise<string> {
  assertNativeRelativePaths(snapshot.source.map((file) => file.path));
  if (digestNativeSource(snapshot.source) !== snapshot.sourceHash)
    throw new Error("native source snapshot digest changed");
  const root = path.resolve(workspaceRoot);
  await assertRuntimeDirectory(root);
  const dist = path.join(root, "dist");
  const stagingRoot = path.join(dist, "skill-release");
  await ensureOwnedParent(dist);
  await ensureOwnedParent(stagingRoot);
  const stage = await fs.mkdtemp(path.join(stagingRoot, "candidate-"));
  const source = path.join(stage, "source");
  await fs.mkdir(source);
  for (const file of snapshot.source) {
    const output = path.join(source, ...file.path.split("/"));
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, file.data, { flag: "wx" });
  }
  const written = await Promise.all(
    snapshot.source.map(async (file) => ({
      path: file.path,
      data: await fs.readFile(path.join(source, ...file.path.split("/")))
    }))
  );
  if (digestNativeSource(written) !== snapshot.sourceHash)
    throw new Error(`staged native source changed: ${stage}`);
  await fs.writeFile(
    path.join(stage, "source-files.json"),
    `${JSON.stringify({ sha256: snapshot.sourceHash, files: snapshot.source.map((file) => file.path) }, null, 2)}\n`,
    { flag: "wx" }
  );
  await packSkillPackageSnapshot(snapshot.skills, path.join(stage, "skills"));
  return stage;
}
