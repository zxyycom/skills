import path from "node:path";
import { toPosix } from "../../shared/src/node/filesystem.ts";
import { openVersionControl } from "../../shared/src/version-control/index.ts";

export type HeadDecisionPathsResult = {
  errors: string[];
  paths: Set<string>;
};

export async function loadHeadDecisionPaths(
  decisionsDirectory: string
): Promise<HeadDecisionPathsResult> {
  try {
    const repository = await openVersionControl(decisionsDirectory);
    const revision = await repository.getCurrentRevision();
    if (revision === null) {
      return { errors: [], paths: new Set() };
    }

    const repositoryScope = toPosix(path.relative(
      repository.rootDirectory,
      path.resolve(decisionsDirectory)
    ));
    const repositoryPaths = await repository.listRevisionFiles(
      revision,
      repositoryScope.length === 0
        ? {}
        : { pathScopes: [repositoryScope] }
    );
    return {
      errors: [],
      paths: collectDecisionPaths(repositoryPaths, repositoryScope)
    };
  } catch (error) {
    return {
      errors: [
        "Git HEAD decision paths are unavailable for "
        + decisionsDirectory
        + ": "
        + errorText(error)
      ],
      paths: new Set()
    };
  }
}

function collectDecisionPaths(
  repositoryPaths: readonly string[],
  repositoryScope: string
): Set<string> {
  const pathPrefix = repositoryScope.length === 0
    ? ""
    : `${repositoryScope}/`;
  return new Set(repositoryPaths.flatMap((candidate) => (
    candidate.startsWith(pathPrefix) && candidate.endsWith(".md")
      ? [candidate.slice(pathPrefix.length)]
      : []
  )));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
