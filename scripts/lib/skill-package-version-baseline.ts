import { format, type FormatConfig } from "oxfmt";
import {
  openVersionControl,
  type VersionControlFile,
  type VersionControlRepository
} from "../../tools/shared/src/version-control/index.ts";
import {
  readSkillVersionFromMarkdown,
  skillEntryFileName
} from "../../tools/skill-package/src/version.ts";
import type {
  SkillPackageFile,
  SkillPackageSnapshot
} from "./skill-package-hash.ts";
import { loadOxfmtFormatConfig } from "./oxc-config.ts";
import { rootDir } from "./project.ts";
import { resolveSkillTrees, type SkillTree } from "./skill-package-tree.ts";
import {
  classifyPackageVersionChange,
  isLinkedSourceMap
} from "./skill-package-versioning.ts";

export type SkillPackageVersionBaseline = Readonly<{
  revision: string;
  skills: Readonly<Record<string, number | null>>;
}>;

/** @internal The only version-control operations the baseline comparison consumes. */
type SkillPackageBaselineRepository = Pick<
  VersionControlRepository,
  "listRevisionFiles" | "readRevisionFile" | "resolveRevision" | "rootDirectory"
>;

type SkillBaselineReadOptions = Readonly<{
  baselineRef: string;
  currentFiles: readonly SkillPackageFile[];
  repository: SkillPackageBaselineRepository;
  revision: string;
  revisionFileCache: Map<string, VersionControlFile | null>;
  skillBaselinePaths: readonly string[];
  tree: SkillTree;
  workspaceRoot: string;
}>;

async function formatDeclarationForVersionGate(
  filePath: string,
  contents: Buffer,
  formatConfig: FormatConfig
): Promise<string> {
  const result = await format(
    filePath,
    contents.toString("utf8"),
    formatConfig
  );
  if (result.errors.length > 0) {
    const messages = result.errors.map((error) => error.message).join("; ");
    throw new Error(
      `Could not canonicalize declaration ${filePath} for skill version validation: ${messages}`
    );
  }

  return result.code;
}

async function haveVersionBearingSkillPackageChanges(
  currentFiles: readonly SkillPackageFile[],
  baselinePaths: readonly string[],
  readBaselineFile: (filePath: string) => Promise<SkillPackageFile | undefined>,
  workspaceRoot: string
): Promise<boolean> {
  const currentFilesByPath = new Map(
    currentFiles.map((file) => [file.path, file])
  );
  const baselinePathsSet = new Set(baselinePaths);
  const currentPaths = new Set(currentFiles.map((file) => file.path));
  let formatConfig: Promise<FormatConfig> | undefined;

  async function isLinkedSourceMapChange(filePath: string): Promise<boolean> {
    return (
      (await isLinkedSourceMap(filePath, async (bundlePath) =>
        currentFilesByPath.get(bundlePath)
      )) || (await isLinkedSourceMap(filePath, readBaselineFile))
    );
  }

  for (const currentFile of currentFiles) {
    const changeKind = classifyPackageVersionChange(currentFile.path);
    if (changeKind === "linked-source-map-candidate") {
      if (await isLinkedSourceMapChange(currentFile.path)) {
        continue;
      }
      const baselineFile = baselinePathsSet.has(currentFile.path)
        ? await readBaselineFile(currentFile.path)
        : undefined;
      if (
        baselineFile === undefined ||
        !currentFile.data.equals(baselineFile.data)
      ) {
        return true;
      }
      continue;
    }

    const baselineFile = baselinePathsSet.has(currentFile.path)
      ? await readBaselineFile(currentFile.path)
      : undefined;
    if (baselineFile === undefined) {
      return true;
    }
    if (currentFile.data.equals(baselineFile.data)) {
      continue;
    }
    if (changeKind === "ordinary") {
      return true;
    }
    formatConfig ??= loadOxfmtFormatConfig(workspaceRoot);
    const loadedFormatConfig = await formatConfig;
    if (
      (await formatDeclarationForVersionGate(
        currentFile.path,
        currentFile.data,
        loadedFormatConfig
      )) !==
      (await formatDeclarationForVersionGate(
        baselineFile.path,
        baselineFile.data,
        loadedFormatConfig
      ))
    ) {
      return true;
    }
  }

  for (const baselinePath of baselinePaths) {
    if (currentPaths.has(baselinePath)) {
      continue;
    }
    if (!(await isLinkedSourceMapChange(baselinePath))) {
      return true;
    }
  }
  return false;
}

async function readCachedRevisionFile(
  repository: Pick<SkillPackageBaselineRepository, "readRevisionFile">,
  revision: string,
  filePath: string,
  cache: Map<string, VersionControlFile | null>
): Promise<VersionControlFile | null> {
  if (cache.has(filePath)) {
    return cache.get(filePath) ?? null;
  }

  const file = await repository.readRevisionFile(revision, filePath);
  cache.set(filePath, file);
  return file;
}

function groupBaselinePathsBySkill(
  trees: readonly SkillTree[],
  baselinePaths: readonly string[]
): Map<string, string[]> {
  const treesByLongestPath = [...trees].sort(
    (left, right) => right.treePath.length - left.treePath.length
  );
  const pathsBySkill = new Map<string, string[]>(
    trees.map((tree) => [tree.skillName, []])
  );
  for (const baselinePath of baselinePaths) {
    const tree = treesByLongestPath.find(
      (candidate) =>
        baselinePath === candidate.treePath ||
        baselinePath.startsWith(`${candidate.treePath}/`)
    );
    if (tree === undefined) {
      throw new Error(
        `Baseline version-control path is outside selected skills: ${baselinePath}`
      );
    }

    const relativePath =
      baselinePath === tree.treePath
        ? ""
        : baselinePath.slice(`${tree.treePath}/`.length);
    pathsBySkill.get(tree.skillName)?.push(relativePath);
  }
  for (const skillPaths of pathsBySkill.values()) {
    skillPaths.sort((left, right) => left.localeCompare(right));
  }
  return pathsBySkill;
}

async function readChangedSkillBaselineVersion(
  options: SkillBaselineReadOptions
): Promise<number | null | undefined> {
  const baselinePathsSet = new Set(options.skillBaselinePaths);
  async function readBaselineSkillFile(
    skillBaselinePath: string
  ): Promise<SkillPackageFile | undefined> {
    if (!baselinePathsSet.has(skillBaselinePath)) {
      return undefined;
    }
    const baselinePath = `${options.tree.treePath}/${skillBaselinePath}`;
    const baselineFile = await readCachedRevisionFile(
      options.repository,
      options.revision,
      baselinePath,
      options.revisionFileCache
    );
    if (baselineFile === null) {
      throw new Error(
        `Baseline revision ${options.revision} did not return listed file ${baselinePath}`
      );
    }
    return {
      data: Buffer.from(baselineFile.data),
      path: skillBaselinePath
    };
  }

  if (
    !(await haveVersionBearingSkillPackageChanges(
      options.currentFiles,
      options.skillBaselinePaths,
      readBaselineSkillFile,
      options.workspaceRoot
    ))
  ) {
    return undefined;
  }

  const skillEntryPath = `${options.tree.treePath}/${skillEntryFileName}`;
  const skillEntry = await readCachedRevisionFile(
    options.repository,
    options.revision,
    skillEntryPath,
    options.revisionFileCache
  );
  return skillEntry === null
    ? null
    : readSkillVersionFromMarkdown(
        Buffer.from(skillEntry.data).toString("utf8"),
        `${options.baselineRef}:${skillEntryPath}`
      );
}

export async function readSkillPackageSnapshotVersionBaseline(
  snapshot: SkillPackageSnapshot,
  baselineRef: string = "HEAD",
  workspaceRoot: string = rootDir
): Promise<SkillPackageVersionBaseline> {
  const repository = await openVersionControl(workspaceRoot);
  return await readSkillPackageSnapshotVersionBaselineFromRepository(
    snapshot,
    baselineRef,
    repository,
    workspaceRoot
  );
}

/**
 * @internal Compares one already-captured package snapshot with a resolved
 * baseline source. The public entry point above opens the production Git
 * repository; this narrow source-module seam only keeps content rules testable
 * without rebuilding Git state for each case.
 */
export async function readSkillPackageSnapshotVersionBaselineFromRepository(
  snapshot: SkillPackageSnapshot,
  baselineRef: string,
  repository: SkillPackageBaselineRepository,
  workspaceRoot: string = rootDir
): Promise<SkillPackageVersionBaseline> {
  const revision = await repository.resolveRevision(baselineRef);
  if (snapshot.skills.length === 0) {
    return {
      revision,
      skills: {}
    };
  }

  const trees = resolveSkillTrees(snapshot.skills, repository.rootDirectory);
  const baselinePaths = await repository.listRevisionFiles(revision, {
    pathScopes: trees.map((tree) => tree.treePath)
  });
  const baselinePathsBySkill = groupBaselinePathsBySkill(trees, baselinePaths);

  const baselineSkills: Record<string, number | null> = {};
  const revisionFileCache = new Map<string, VersionControlFile | null>();

  for (const tree of trees) {
    const baselineVersion = await readChangedSkillBaselineVersion({
      baselineRef,
      currentFiles: snapshot.filesBySkill.get(tree.skillName) ?? [],
      repository,
      revision,
      revisionFileCache,
      skillBaselinePaths: baselinePathsBySkill.get(tree.skillName) ?? [],
      tree,
      workspaceRoot
    });
    if (baselineVersion !== undefined) {
      baselineSkills[tree.skillName] = baselineVersion;
    }
  }

  return {
    revision,
    skills: baselineSkills
  };
}
