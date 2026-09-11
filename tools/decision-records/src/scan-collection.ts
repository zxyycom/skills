import fs from "node:fs/promises";
import path from "node:path";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import { decisionIndexFileName } from "./decision-state-index.ts";
import { addCollectionError, errorText } from "./scan-support.ts";
import type { SourceFile, SourceFileMembers } from "./scan-contracts.ts";
import type { DecisionId } from "./types.ts";

const allowedRootFiles = new Set([decisionIndexFileName]);

type CollectionContext = {
  collectionErrors: string[];
  decisionsDirectory: string;
  decisionsLabel: string;
  sourceErrors: string[];
  sources: SourceFile[];
};

export async function collectSourceFiles(options: {
  collectionErrors: string[];
  decisionsDirectory: string;
  decisionsLabel: string;
  sourceErrors: string[];
}): Promise<SourceFile[]> {
  const context: CollectionContext = { ...options, sources: [] };
  const rootEntries = await fs.readdir(context.decisionsDirectory, {
    withFileTypes: true
  });
  rootEntries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of rootEntries) await collectRootEntry(context, entry);
  return context.sources;
}

async function collectRootEntry(
  context: CollectionContext,
  entry: { isDirectory(): boolean; isFile(): boolean; name: string }
): Promise<void> {
  const entryPath = path.join(context.decisionsDirectory, entry.name);
  if (entry.isFile()) return collectRootFile(context, entry.name, entryPath);
  if (!entry.isDirectory()) return addUnsupportedRootEntry(context, entry.name);
  if (entry.name !== "archive")
    return addUnsupportedRootDirectory(context, entry.name);
  await collectArchivedSourceFiles({
    archiveDirectory: entryPath,
    collectionErrors: context.collectionErrors,
    sourceErrors: context.sourceErrors,
    sources: context.sources
  });
}

function collectRootFile(
  context: CollectionContext,
  name: string,
  entryPath: string
): void {
  if (name.endsWith(".md")) {
    context.sources.push({ decisionPath: entryPath, sourcePath: name });
    return;
  }
  if (!allowedRootFiles.has(name)) {
    addCollectionError(
      context.collectionErrors,
      context.sourceErrors,
      context.decisionsLabel + " root contains unsupported file " + name
    );
  }
}

function addUnsupportedRootEntry(
  context: CollectionContext,
  name: string
): void {
  addCollectionError(
    context.collectionErrors,
    context.sourceErrors,
    context.decisionsLabel + " contains unsupported entry " + name
  );
}

function addUnsupportedRootDirectory(
  context: CollectionContext,
  name: string
): void {
  addCollectionError(
    context.collectionErrors,
    context.sourceErrors,
    context.decisionsLabel + " root contains unsupported directory " + name
  );
}

async function collectArchivedSourceFiles(options: {
  archiveDirectory: string;
  collectionErrors: string[];
  sourceErrors: string[];
  sources: SourceFile[];
}): Promise<void> {
  let archivedEntries;
  try {
    archivedEntries = await fs.readdir(options.archiveDirectory, {
      withFileTypes: true
    });
  } catch (error) {
    addCollectionError(
      options.collectionErrors,
      options.sourceErrors,
      "Decision archive could not be read: " + errorText(error)
    );
    return;
  }
  archivedEntries.sort((left, right) => left.name.localeCompare(right.name));
  for (const archivedEntry of archivedEntries) {
    const sourcePath = "archive/" + archivedEntry.name;
    if (!archivedEntry.isFile() || !archivedEntry.name.endsWith(".md")) {
      addCollectionError(
        options.collectionErrors,
        options.sourceErrors,
        "Decision archive must contain only Markdown files: " + sourcePath
      );
      continue;
    }
    options.sources.push({
      decisionPath: path.join(options.archiveDirectory, archivedEntry.name),
      sourcePath
    });
  }
}

export async function validateSourceMembership(
  sourceFiles: readonly SourceFile[],
  collectionErrors: string[],
  sourceErrors: string[]
): Promise<ReadonlySet<DecisionId>> {
  const sourceFilesById = new Map<string, SourceFileMembers>();
  for (const sourceFile of sourceFiles) {
    let decisionId: DecisionId | null = null;
    try {
      sourceFile.sourceText = await fs.readFile(
        sourceFile.decisionPath,
        "utf8"
      );
      decisionId = decisionIdFromMarkdown(sourceFile.sourceText);
    } catch {
      // Full source scanning reports the filesystem failure with its path.
    }
    if (decisionId === null) continue;
    const members = sourceFilesById.get(decisionId);
    if (members === undefined) {
      sourceFilesById.set(decisionId, [sourceFile]);
    } else {
      members.push(sourceFile);
    }
  }

  const availableDecisionIds = new Set<DecisionId>();
  for (const [decisionId, members] of sourceFilesById) {
    if (members.length === 1) {
      availableDecisionIds.add(decisionId as DecisionId);
    }
    if (members.length > 1) {
      addCollectionError(
        collectionErrors,
        sourceErrors,
        "Decision ID occurs in more than one source path: " +
          decisionId +
          " (" +
          members.map((member) => member.sourcePath).join(", ") +
          ")"
      );
    }
  }
  return availableDecisionIds;
}
