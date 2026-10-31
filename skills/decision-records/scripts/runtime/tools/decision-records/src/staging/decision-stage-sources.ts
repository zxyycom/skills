/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/staging/decision-stage-sources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/staging/decision-stage-sources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/staging/decision-stage-sources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import type { VersionControlFile } from "../../../shared/src/version-control/index.ts";
import { decisionIdFromMarkdown } from "../records/decision-metadata.ts";
import { isDecisionSourcePath } from "../collection/decision-path.ts";
import {
  decodeUtf8,
  readStageDirectory,
  readStageFile,
  repositoryPath
} from "./decision-stage-support.ts";
import type {
  DecisionStageSource,
  FilesystemDecisionCandidates
} from "./decision-stage-contracts.ts";
import type { DecisionId } from "../types.ts";

/** One phase-local discovery; selected resolution owns which failures matter. */
export async function readFilesystemDecisionCandidates(
  decisionsDirectory: string,
  decisionScope: string
): Promise<FilesystemDecisionCandidates> {
  const sources = new Map<DecisionId, DecisionStageSource>();
  const duplicateIds = new Set<DecisionId>();
  const inspect = async (sourcePath: string): Promise<void> => {
    if (!isDecisionSourcePath(sourcePath)) return;
    try {
      const data = await readStageFile(
        path.join(decisionsDirectory, ...sourcePath.split("/"))
      );
      const source = stageSourceFromFile(
        {
          data,
          kind: "regular",
          path: repositoryPath(decisionScope, sourcePath)
        },
        sourcePath
      );
      if (sources.has(source.source.decisionId))
        duplicateIds.add(source.source.decisionId);
      else sources.set(source.source.decisionId, source);
    } catch {
      // Unidentifiable sources do not enter identity discovery; selected reads and full check validate them.
    }
  };
  for (const entry of await readStageDirectory(decisionsDirectory)) {
    if (entry.name === "archive" && entry.isDirectory()) {
      for (const archived of await readStageDirectory(
        path.join(decisionsDirectory, "archive")
      )) {
        await inspect("archive/" + archived.name);
      }
    } else {
      await inspect(entry.name);
    }
  }
  return { duplicateIds, sources };
}

export function stageSourceFromFile(
  file: VersionControlFile,
  sourcePath: string
): DecisionStageSource {
  if (!isDecisionSourcePath(sourcePath)) {
    throw new Error("invalid decision source path: " + sourcePath);
  }
  const text = decodeUtf8(file.data, sourcePath);
  const decisionId = decisionIdFromMarkdown(text);
  if (decisionId === null) {
    throw new Error(
      "decision source must declare a valid frontmatter Decision ID: " +
        sourcePath
    );
  }
  return {
    file,
    source: {
      decisionId,
      sourcePath,
      text
    }
  };
}
