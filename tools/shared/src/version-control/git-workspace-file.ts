import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import { runGitForExitCode } from "./git-command.ts";
import type { GitRepositoryContext } from "./git-context.ts";
import { fileKindForGitMode, operationError } from "./git-core.ts";
import { listPendingEntries } from "./git-pending.ts";
import { normalizeRepositoryPath } from "./repository-path.ts";
import type { VersionControlFile, VersionControlFileKind } from "./types.ts";

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
    return (mode & userExecuteBit) === 0 ? "regular" : "executable";
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
