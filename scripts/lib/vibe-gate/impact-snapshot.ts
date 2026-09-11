import fs from "node:fs/promises";
import path from "node:path";
import { rootDir } from "../project.ts";
import {
  allImpactTags,
  gateImpactContractVersion,
  type GateImpactTag
} from "./impact-catalog.ts";
import { impactTagsForPath } from "./impact-paths.ts";
import {
  captureCommand,
  toolchainFingerprint,
  type CaptureDependencies
} from "./impact-toolchain.ts";
import { compareText, sha256 } from "./impact-values.ts";

const maximumSnapshotFileCount = 20_000;
const maximumSnapshotBytes = 536_870_912;

type SnapshotFileKind = "file" | "missing" | "symlink" | "unsupported";

export type GateWorkspaceFile = Readonly<{
  digest: string;
  kind: SnapshotFileKind;
  mode: number | null;
  path: string;
  size: number;
  tags: readonly GateImpactTag[];
}>;

export type GateWorkspaceSnapshot = Readonly<{
  files: readonly GateWorkspaceFile[];
  tagDigests: Readonly<Record<GateImpactTag, string>>;
  toolchainFingerprint: string;
  unclassifiedPaths: readonly string[];
  workspaceFingerprint: string;
}>;

async function readSnapshotFile(
  workspaceRoot: string,
  relativePath: string,
  reserveBytes: (size: number) => void
): Promise<GateWorkspaceFile> {
  const absolutePath = path.join(workspaceRoot, ...relativePath.split("/"));
  const impact = impactTagsForPath(relativePath);
  try {
    const status = await fs.lstat(absolutePath);
    const mode = status.mode & 0o777;
    if (status.isFile()) {
      reserveBytes(status.size);
      const contents = await fs.readFile(absolutePath);
      if (contents.byteLength > status.size) {
        reserveBytes(contents.byteLength - status.size);
      }
      return {
        digest: sha256([contents]),
        kind: "file",
        mode,
        path: relativePath,
        size: contents.byteLength,
        tags: impact.tags
      };
    }
    if (status.isSymbolicLink()) {
      return {
        digest: sha256([await fs.readlink(absolutePath)]),
        kind: "symlink",
        mode,
        path: relativePath,
        size: 0,
        tags: impact.tags
      };
    }
    return {
      digest: sha256(["unsupported"]),
      kind: "unsupported",
      mode,
      path: relativePath,
      size: 0,
      tags: [...new Set([...impact.tags, "global" as const])].sort(compareText)
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        digest: sha256(["missing"]),
        kind: "missing",
        mode: null,
        path: relativePath,
        size: 0,
        tags: impact.tags
      };
    }
    throw error;
  }
}

function parseGitPaths(output: Buffer): readonly string[] {
  const decoded = output.toString("utf8");
  if (!Buffer.from(decoded, "utf8").equals(output)) {
    throw new Error("Git returned a path list that is not valid UTF-8");
  }
  const paths = decoded.split("\0").filter((value) => value.length > 0);
  if (paths.length > maximumSnapshotFileCount) {
    throw new Error("Gate snapshot file count exceeded its safety limit");
  }
  if (
    paths.some(
      (relativePath) =>
        path.posix.isAbsolute(relativePath) ||
        path.win32.isAbsolute(relativePath) ||
        relativePath.split("/").some((segment) => segment === "..")
    )
  ) {
    throw new Error("Git returned a path outside the Gate workspace");
  }
  return [...new Set(paths)].sort(compareText);
}

async function readSnapshotFiles(
  workspaceRoot: string,
  relativePaths: readonly string[]
): Promise<readonly GateWorkspaceFile[]> {
  const files: GateWorkspaceFile[] = [];
  let reservedBytes = 0;
  const reserveBytes = (size: number): void => {
    reservedBytes += size;
    if (reservedBytes > maximumSnapshotBytes) {
      throw new Error("Gate snapshot byte count exceeded its safety limit");
    }
  };
  for (let offset = 0; offset < relativePaths.length; offset += 32) {
    const batch = relativePaths.slice(offset, offset + 32);
    const captured = await Promise.all(
      batch.map(async (relativePath) => {
        return await readSnapshotFile(
          workspaceRoot,
          relativePath,
          reserveBytes
        );
      })
    );
    files.push(...captured);
  }
  return files;
}

function digestFileIdentities(files: readonly GateWorkspaceFile[]): string {
  return sha256(
    files.flatMap((file) => [
      file.path,
      "\0",
      file.kind,
      "\0",
      String(file.mode),
      "\0",
      String(file.size),
      "\0",
      file.digest,
      "\0"
    ])
  );
}

function digestPathIdentities(files: readonly GateWorkspaceFile[]): string {
  return sha256(
    files.flatMap((file) => [
      file.path,
      "\0",
      file.kind,
      "\0",
      file.kind === "symlink" ? file.digest : "",
      "\0"
    ])
  );
}

export async function captureGateWorkspaceSnapshot(
  workspaceRoot: string = rootDir,
  dependencies: CaptureDependencies = {}
): Promise<GateWorkspaceSnapshot> {
  const runCommand = dependencies.captureCommand ?? captureCommand;
  const relativePaths = parseGitPaths(
    await runCommand(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      workspaceRoot
    )
  );
  const [files, toolchain] = await Promise.all([
    readSnapshotFiles(workspaceRoot, relativePaths),
    toolchainFingerprint(workspaceRoot, dependencies)
  ]);
  const tagDigests = Object.fromEntries(
    allImpactTags.map((tag) => [
      tag,
      tag === "path-inventory"
        ? digestPathIdentities(files)
        : digestFileIdentities(files.filter((file) => file.tags.includes(tag)))
    ])
  ) as Record<GateImpactTag, string>;
  const unclassifiedPaths = files
    .filter(({ path: filePath }) => impactTagsForPath(filePath).unclassified)
    .map(({ path: filePath }) => filePath);
  return {
    files,
    tagDigests,
    toolchainFingerprint: toolchain,
    unclassifiedPaths,
    workspaceFingerprint: sha256([
      gateImpactContractVersion,
      toolchain,
      digestFileIdentities(files)
    ])
  };
}
