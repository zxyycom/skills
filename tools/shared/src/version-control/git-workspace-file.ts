import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import { runGitForExitCode } from "./git-command.ts";
import type { GitRepositoryContext } from "./git-context.ts";
import { fileKindForGitMode, operationError } from "./git-core.ts";
import { listPendingEntries } from "./git-pending.ts";
import {
  normalizeRepositoryPath,
  normalizeRepositoryPaths
} from "./repository-path.ts";
import type {
  ReadWorkspaceFilesOptions,
  VersionControlFile,
  VersionControlFileKind
} from "./types.ts";

const userExecuteBit = 0o100;

export async function readWorkspaceFile(
  context: GitRepositoryContext,
  filePath: string
): Promise<VersionControlFile | null> {
  const normalized = normalizeRepositoryPath(filePath);
  const absolute = path.join(context.rootDirectory, ...normalized.split("/"));
  try {
    const entry = await workspaceFileStat(absolute);
    if (entry === null) return null;
    if (!entry.isFile() || entry.isSymbolicLink())
      throw operationError("read a regular non-symlink workspace file");
    const kind = await workspaceFileKind(context, normalized, entry.mode);
    return { data: await fs.readFile(absolute), kind, path: normalized };
  } catch (cause) {
    throw operationError("read a workspace file", cause, {
      target: normalized
    });
  }
}

/** One invocation owns one fresh policy and pending-representation basis. */
export async function readWorkspaceFiles(
  context: GitRepositoryContext,
  filePaths: readonly string[],
  options: ReadWorkspaceFilesOptions = {}
): Promise<VersionControlFile[]> {
  const paths = normalizeRepositoryPaths(filePaths);
  const sources: WorkspaceSource[] = [];
  for (const filePath of paths) {
    const source = await readWorkspaceSource(context, filePath);
    if (source !== null) sources.push(source);
  }
  if (sources.length === 0) return [];
  const honorsExecuteBit = await honorsWorkspaceExecuteBit(context);
  const selectedPaths = sources.map((source) => source.path);
  const pendingKinds = honorsExecuteBit
    ? new Map<string, RegularFileKind>()
    : await workspacePendingKinds(context, selectedPaths, options);
  const files: VersionControlFile[] = [];
  for (const source of sources) {
    let kind: RegularFileKind;
    if (honorsExecuteBit) kind = kindFromExecuteBit(source.mode);
    else kind = pendingKinds.get(source.path) ?? "regular";
    files.push(await readWorkspaceSourceBytes(source, kind));
  }
  return files;
}

type RegularFileKind = Exclude<VersionControlFileKind, "symlink">;
type WorkspaceSource = Readonly<{
  path: string;
  absolute: string;
  mode: number;
}>;

async function readWorkspaceSourceBytes(
  source: WorkspaceSource,
  kind: RegularFileKind
): Promise<VersionControlFile> {
  try {
    return {
      path: source.path,
      data: await fs.readFile(source.absolute),
      kind
    };
  } catch (cause) {
    throw operationError("read a workspace file", cause, {
      target: source.path
    });
  }
}

async function readWorkspaceSource(
  context: GitRepositoryContext,
  filePath: string
): Promise<WorkspaceSource | null> {
  const absolute = path.join(context.rootDirectory, ...filePath.split("/"));
  try {
    const entry = await workspaceFileStat(absolute);
    if (entry === null) return null;
    if (!entry.isFile() || entry.isSymbolicLink())
      throw operationError("read a regular non-symlink workspace file");
    return { path: filePath, absolute, mode: entry.mode };
  } catch (cause) {
    throw operationError("read a workspace file", cause, { target: filePath });
  }
}

async function readPendingWorkspaceKinds(
  context: GitRepositoryContext,
  paths: readonly string[]
): Promise<Map<string, RegularFileKind>> {
  const selected = new Set(paths);
  const kinds = new Map<string, RegularFileKind>();
  for (const entry of await listPendingEntries(context, paths)) {
    if (!selected.has(entry.path) || kinds.has(entry.path) || entry.stage !== 0)
      throw operationError(
        "resolve pending conflicts before reading workspace representation",
        undefined,
        { target: entry.path }
      );
    const kind = fileKindForGitMode(entry.mode);
    if (kind === "symlink")
      throw operationError(
        "read a regular non-symlink workspace representation",
        undefined,
        { target: entry.path }
      );
    kinds.set(entry.path, kind);
  }
  return kinds;
}

async function workspacePendingKinds(
  context: GitRepositoryContext,
  paths: readonly string[],
  options: ReadWorkspaceFilesOptions
): Promise<Map<string, RegularFileKind>> {
  if (options.pendingFiles !== undefined)
    return pendingWorkspaceKinds(options.pendingFiles, paths);
  return await readPendingWorkspaceKinds(context, paths);
}

function pendingWorkspaceKinds(
  files: readonly VersionControlFile[],
  paths: readonly string[]
): Map<string, RegularFileKind> {
  const selected = new Set(paths);
  const kinds = new Map<string, RegularFileKind>();
  for (const file of files) {
    const normalized = normalizeRepositoryPath(file.path);
    if (!selected.has(normalized)) continue;
    if (
      kinds.has(normalized) ||
      (file.kind !== "regular" && file.kind !== "executable")
    )
      throw operationError(
        "read a unique regular pending representation",
        undefined,
        { target: normalized }
      );
    kinds.set(normalized, file.kind);
  }
  return kinds;
}

function kindFromExecuteBit(mode: number): RegularFileKind {
  return (mode & userExecuteBit) === 0 ? "regular" : "executable";
}

async function workspaceFileStat(absolute: string): Promise<Stats | null> {
  try {
    return await fs.lstat(absolute);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

async function workspaceFileKind(
  context: GitRepositoryContext,
  filePath: string,
  mode: number
): Promise<Exclude<VersionControlFileKind, "symlink">> {
  if (await honorsWorkspaceExecuteBit(context)) {
    return kindFromExecuteBit(mode);
  }
  const [entry, ...others] = await listPendingEntries(context, [filePath]);
  if (entry === undefined) {
    return "regular";
  }
  if (others.length > 0 || entry.path !== filePath || entry.stage !== 0) {
    throw operationError(
      "resolve pending conflicts before reading workspace representation"
    );
  }
  const kind = fileKindForGitMode(entry.mode);
  if (kind === "symlink") {
    throw operationError("read a regular non-symlink workspace representation");
  }
  return kind;
}

async function honorsWorkspaceExecuteBit(
  context: GitRepositoryContext
): Promise<boolean> {
  const config = await runGitForExitCode(context.rootDirectory, [
    "config",
    "--type=bool",
    "--get",
    "core.fileMode"
  ]);
  const value = config.stdout.trim();
  if (config.exitCode === 1 && value === "" && config.stderr.trim() === "") {
    return true;
  }
  if (config.exitCode !== 0 || (value !== "true" && value !== "false")) {
    throw operationError(
      "read the workspace executable-bit policy",
      config.stderr || "configuration did not return a boolean"
    );
  }
  return value === "true";
}
