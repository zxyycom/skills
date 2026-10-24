import fs from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import path from "node:path";
import { isPathWithinDirectory } from "../../shared/src/node/filesystem.ts";

/** 两个记录域的公共 API 与 CLI 使用同一 canonical workspace/collection 边界。 */
export async function canonicalRecordCollection(
  workspace: string,
  collection: string
): Promise<Readonly<{ workspaceRoot: string; collectionRoot: string }>> {
  const workspaceRoot = await fs.realpath(path.resolve(workspace));
  if (path.isAbsolute(collection))
    throw new Error("record collection must be workspace-relative");
  const target = path.resolve(path.resolve(workspace), collection);
  if (!isPathWithinDirectory(target, path.resolve(workspace)))
    throw new Error("record collection must stay within the workspace root");
  const collectionRoot = await fs.realpath(target);
  if (!isPathWithinDirectory(collectionRoot, workspaceRoot))
    throw new Error("record collection must resolve within the workspace root");
  if (
    !(await fs.stat(workspaceRoot)).isDirectory() ||
    !(await fs.stat(collectionRoot)).isDirectory()
  )
    throw new Error("workspace and record collection must be directories");
  return { workspaceRoot, collectionRoot };
}

/** 完整正文读取：同一个安全 handle 的字节、UTF-8 与身份验收，不套搜索预算。 */
export async function readRecordSource(
  options: Readonly<{
    collectionRoot: string;
    sourcePath: string;
    id: string;
    idFromMarkdown: (text: string) => string | null;
  }>
): Promise<string> {
  const markdown = await readRecordText(
    options.collectionRoot,
    options.sourcePath
  );
  if (options.idFromMarkdown(markdown) !== options.id)
    throw new Error("frontmatter record ID does not match the requested ID");
  return markdown;
}

/** 安全取得候选身份和内容的同一份字节；身份解析由领域完成。 */
export async function readRecordText(
  collectionRoot: string,
  sourcePath: string
): Promise<string> {
  const root = await fs.realpath(collectionRoot);
  if (root !== path.resolve(collectionRoot)) {
    throw new Error(
      "record collection canonical identity changed before reading"
    );
  }
  const target = path.resolve(root, sourcePath);
  if (!isPathWithinDirectory(target, root) || target === root) {
    throw new Error("record source must stay within its collection");
  }
  const beforePath = await inspectSourcePath(root, target);
  const handle = await fs.open(
    target,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const before = await handle.stat();
    if (!before.isFile() || !sameSourceIdentity(beforePath.entry, before)) {
      throw new Error("record source changed while opening the file");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const afterPath = await inspectSourcePath(root, target);
    assertStableSource(before, after, beforePath, afterPath);
    const markdown = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true
    }).decode(bytes);
    return markdown;
  } finally {
    await handle.close();
  }
}

export function assertStableSource(
  before: Stats,
  after: Stats,
  beforePath: Awaited<ReturnType<typeof inspectSourcePath>>,
  afterPath: Awaited<ReturnType<typeof inspectSourcePath>>
): void {
  const parentsMatch =
    beforePath.parents.length === afterPath.parents.length &&
    beforePath.parents.every((parent, index) =>
      sameSourceIdentity(parent, afterPath.parents[index]!)
    );
  if (
    !sameFileSnapshot(before, after) ||
    !sameSourceIdentity(after, afterPath.entry) ||
    !parentsMatch
  )
    throw new Error("record source changed while reading the file");
}

function sameFileSnapshot(before: Stats, after: Stats): boolean {
  return (
    sameSourceIdentity(before, after) &&
    before.size === after.size &&
    before.mtimeMs === after.mtimeMs &&
    before.ctimeMs === after.ctimeMs
  );
}

async function inspectSourcePath(root: string, target: string) {
  const rootIdentity = await inspectCollectionDirectory(root);
  const parents = [rootIdentity];
  let current = root;
  const components = path.relative(root, target).split(path.sep);
  for (const [index, component] of components.entries()) {
    current = path.join(current, component);
    const stats = await fs.lstat(current);
    requireSourceComponent(stats, index === components.length - 1);
    if (index < components.length - 1)
      parents.push({ dev: stats.dev, ino: stats.ino });
  }
  // 精确 canonical target 同时证明全部 prefix；根/父链 inode 仍独立前后比较。
  if ((await fs.realpath(target)) !== target)
    throw new Error("record source escaped its canonical collection");
  return { entry: await fs.lstat(target), parents };
}

export function sameSourceIdentity(
  left: Readonly<{ dev: number; ino: number }>,
  right: Readonly<{ dev: number; ino: number }>
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

/** 已解析的集合根在一个读取阶段内不能被替换为另一路径或 inode。 */
export async function recordCollectionIdentity(
  root: string
): Promise<Readonly<{ dev: number; ino: number }>> {
  const resolved = path.resolve(root);
  if ((await fs.realpath(resolved)) !== resolved)
    throw new Error("record collection canonical identity changed");
  return await inspectCollectionDirectory(resolved);
}

async function inspectCollectionDirectory(
  root: string
): Promise<Readonly<{ dev: number; ino: number }>> {
  const stats = await fs.lstat(root);
  requireSourceDirectory(stats);
  return { dev: stats.dev, ino: stats.ino };
}

/** Async and worker reads use the same component/identity rejection rules. */
export function requireSourceComponent(stats: Stats, leaf: boolean): void {
  if (stats.isSymbolicLink() || (leaf ? !stats.isFile() : !stats.isDirectory()))
    throw new Error(
      "record source components must be regular files or directories, without symbolic links"
    );
}
export function requireSourceDirectory(stats: Stats): void {
  if (!stats.isDirectory() || stats.isSymbolicLink())
    throw new Error("record collection must remain a canonical directory");
}
