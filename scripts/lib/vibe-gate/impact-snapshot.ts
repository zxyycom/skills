import fs from "node:fs/promises";
import { createProjectFileRegionIndex } from "@zxyycom/vibe-check";
import path from "node:path";
import { rootDir } from "../project.ts";
import { gateImpactContractVersion } from "./impact-catalog.ts";
import { gateToolInputs } from "./impact-tools.ts";
import {
  gateInputDirectories,
  gateConfigurationFiles,
  isKnownGateInput
} from "./impact-paths.ts";
import {
  captureCommand,
  toolchainFingerprint,
  type CaptureDependencies
} from "./impact-toolchain.ts";
import { compareText, sha256 } from "./impact-values.ts";

const maximumSnapshotFileCount = 20_000;
const maximumSnapshotBytes = 536_870_912;
const narrowedDomainInputPattern =
  /^tools\/(?:decision-records|investigation-report)\/(?:src|tests)\//u;

type SnapshotFileKind =
  | "directory"
  | "file"
  | "missing"
  | "symlink"
  | "unsupported";

export type GateWorkspaceFile = Readonly<{
  digest: string;
  kind: SnapshotFileKind;
  mode: number | null;
  path: string;
  size: number;
}>;

export type GateWorkspaceSnapshot = Readonly<{
  files: readonly GateWorkspaceFile[];
  toolInputDigests: Readonly<Record<string, string>>;
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
  try {
    const status = await fs.lstat(absolutePath);
    const mode = status.mode & 0o777;
    if (status.isFile()) {
      if ((await fs.realpath(absolutePath)) !== absolutePath)
        throw new Error(`Gate input traverses a symlink: ${relativePath}`);
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
        size: contents.byteLength
      };
    }
    if (status.isDirectory())
      return {
        digest: sha256(["directory"]),
        kind: "directory",
        mode,
        path: relativePath,
        size: 0
      };
    if (status.isSymbolicLink()) {
      return {
        digest: sha256([await fs.readlink(absolutePath)]),
        kind: "symlink",
        mode,
        path: relativePath,
        size: 0
      };
    }
    return {
      digest: sha256(["unsupported"]),
      kind: "unsupported",
      mode,
      path: relativePath,
      size: 0
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
        size: 0
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
      batch.map((relativePath) =>
        readSnapshotFile(workspaceRoot, relativePath, reserveBytes)
      )
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

/** Walk the declared command input domain, independently of Git ignore rules. */
async function diskInputPaths(
  workspaceRoot: string
): Promise<readonly string[]> {
  const paths: string[] = [...gateConfigurationFiles];
  const visit = async (relativePath: string): Promise<void> => {
    paths.push(relativePath);
    if (paths.length > maximumSnapshotFileCount)
      throw new Error("Gate disk input count exceeded its safety limit");
    const absolutePath = path.join(workspaceRoot, relativePath);
    const children = await fs.readdir(absolutePath, { withFileTypes: true });
    for (const child of children) {
      const childPath = `${relativePath}/${child.name}`;
      if (child.isDirectory()) await visit(childPath);
      else paths.push(childPath);
      if (paths.length > maximumSnapshotFileCount)
        throw new Error("Gate disk input count exceeded its safety limit");
    }
  };
  for (const directory of gateInputDirectories) {
    const status = await fs
      .lstat(path.join(workspaceRoot, directory))
      .catch((error: unknown) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return null;
        throw error;
      });
    if (status?.isDirectory()) await visit(directory);
    else paths.push(directory);
  }
  return paths;
}

export async function captureGateWorkspaceSnapshot(
  workspaceRoot: string = rootDir,
  dependencies: CaptureDependencies = {}
): Promise<GateWorkspaceSnapshot> {
  workspaceRoot = await fs.realpath(workspaceRoot);
  const runCommand = dependencies.captureCommand ?? captureCommand;
  const [gitPaths, diskPaths] = await Promise.all([
    runCommand(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      workspaceRoot
    ).then(parseGitPaths),
    diskInputPaths(workspaceRoot)
  ]);
  const relativePaths = [...new Set([...gitPaths, ...diskPaths])].sort(
    compareText
  );
  if (relativePaths.length > maximumSnapshotFileCount)
    throw new Error("Gate input count exceeded its safety limit");
  const [files, toolchain] = await Promise.all([
    readSnapshotFiles(workspaceRoot, relativePaths),
    toolchainFingerprint(workspaceRoot, dependencies)
  ]);
  // Many Checks share a closure. Match and hash each distinct closure once.
  const regions = new Map(
    Object.values(gateToolInputs).map((patterns) => {
      const id = JSON.stringify(patterns);
      return [id, { id, kind: "patterns" as const, patterns }] as const;
    })
  );
  const membership = createProjectFileRegionIndex({
    fileSources: [relativePaths],
    regionSources: [[...regions.values()]]
  });
  const byPath = new Map(files.map((file) => [file.path, file]));
  const digests = new Map(
    [...regions.keys()].map((id) => [
      id,
      digestFileIdentities(
        (membership.filesForRegion(id) ?? []).map((filePath) =>
          byPath.get(filePath)!
        )
      )
    ])
  );
  const toolInputDigests = Object.fromEntries(
    Object.entries(gateToolInputs).map(([toolId, patterns]) => [
      toolId,
      digests.get(JSON.stringify(patterns))!
    ])
  );
  // The narrowed domains must have their own reviewed capability owner. A
  // repository-wide formatter/typechecker region is not a semantic input proof.
  const domainCapabilityPaths = new Set(
    Object.entries(gateToolInputs)
      .filter(
        ([toolId]) =>
          toolId.startsWith("decision-") || toolId.startsWith("investigation-")
      )
      .flatMap(
        ([, patterns]) =>
          membership.filesForRegion(JSON.stringify(patterns)) ?? []
      )
  );
  const unclassifiedPaths = files
    .filter(
      (file) =>
        !isKnownGateInput(file.path) ||
        file.kind === "symlink" ||
        file.kind === "unsupported" ||
        (file.kind !== "directory" &&
          narrowedDomainInputPattern.test(file.path) &&
          !domainCapabilityPaths.has(file.path))
    )
    .map((file) => file.path);
  return {
    files,
    toolInputDigests,
    toolchainFingerprint: toolchain,
    unclassifiedPaths,
    workspaceFingerprint: sha256([
      gateImpactContractVersion,
      toolchain,
      digestFileIdentities(files)
    ])
  };
}
