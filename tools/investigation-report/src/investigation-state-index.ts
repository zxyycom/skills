import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import * as v from "valibot";
import {
  defineStateIndexDefinition,
  loadCurrentStateIndex,
  syncStateIndex,
  type StateIndex,
  type StateIndexContext,
  type StateIndexDefinition,
  type StateIndexDiagnostic,
  type StateIndexResult,
  type StateIndexSyncMode,
  type StateIndexSyncResult,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import {
  isInvestigationTopicPath,
  investigationCategoryOf
} from "./report-path.ts";
import { buildInvestigationTopicState } from "./report-validation.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  investigationReportStatuses,
  type InvestigationIndexState
} from "./types.ts";

export const investigationIndexFileName = "investigation-index.json";
export const investigationIndexNamespace = "investigations";
export const investigationIndexDefinitionVersion = 2;

const sourceReadConcurrency = 32;
const nonEmptyStringSchema = v.pipe(
  v.string("must be a string"),
  v.check(
    (value) => value.length > 0 && value.trim() === value,
    "must be non-empty text without surrounding whitespace"
  )
);
const investigationIndexStateSchema = v.strictObject({
  latestReportAt: v.pipe(
    nonEmptyStringSchema,
    v.check(
      (value) => investigationTimestampMilliseconds(value) !== null,
      "must be an RFC 3339 timestamp with timezone and second precision"
    )
  ),
  path: v.pipe(
    nonEmptyStringSchema,
    v.check(
      isInvestigationTopicPath,
      "must use <category-id>/<semantic-slug>.md"
    )
  ),
  question: nonEmptyStringSchema,
  reportCount: v.pipe(
    v.number("must be a number"),
    v.integer("must be an integer"),
    v.minValue(1, "must be at least 1")
  ),
  reportTitles: v.pipe(
    v.array(nonEmptyStringSchema, "must be an array"),
    v.minLength(1, "must contain at least one report title")
  ),
  status: v.picklist(investigationReportStatuses),
  title: nonEmptyStringSchema
});

type InvestigationSource = {
  path: string;
  text: string;
};

export function createInvestigationStateIndexDefinition(
): StateIndexDefinition<InvestigationIndexState> {
  return defineStateIndexDefinition({
    definitionVersion: investigationIndexDefinitionVersion,
    identify: (state) => state.path,
    keyStrategies: [
      {
        derive: (state) => investigationTimestampMilliseconds(
          state.latestReportAt
        ) ?? undefined,
        mode: "range",
        name: "latest-report-at"
      },
      {
        derive: (state) => state.status,
        mode: "exact",
        name: "status"
      },
      {
        derive: (state) => [
          state.title,
          state.question,
          ...state.reportTitles
        ],
        mode: "text",
        name: "text"
      },
      {
        derive: (state) => investigationCategoryOf(state.path) ?? undefined,
        mode: "exact",
        name: "category"
      }
    ],
    namespace: investigationIndexNamespace,
    parseState: parseInvestigationIndexState,
    read: async (context) => await readInvestigationStateSnapshot(
      context.root,
      context.signal
    ),
    readRevision: async (context) => await readInvestigationSourceRevision(
      context.root,
      context.signal
    )
  });
}

export async function discoverInvestigationTopicPaths(
  investigationsDirectory: string
): Promise<string[]> {
  return (await fastGlob("**/*.md", {
    cwd: investigationsDirectory,
    dot: false,
    followSymbolicLinks: false,
    onlyFiles: true
  }))
    .map((relativePath) => relativePath.replace(/\\/gu, "/"))
    .sort(compareText);
}

export async function loadCurrentInvestigationIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  signal?: AbortSignal;
}): Promise<StateIndexResult<StateIndex>> {
  return await loadCurrentStateIndex({
    context: stateIndexContext(
      options.investigationsDirectory,
      options.signal
    ),
    definition: createInvestigationStateIndexDefinition(),
    indexPath: options.indexPath ?? investigationIndexFileName
  });
}

export async function syncInvestigationStateIndex(options: {
  investigationsDirectory: string;
  indexPath?: string;
  mode: StateIndexSyncMode;
  signal?: AbortSignal;
}): Promise<StateIndexSyncResult> {
  return await syncStateIndex({
    context: stateIndexContext(
      options.investigationsDirectory,
      options.signal
    ),
    definition: createInvestigationStateIndexDefinition(),
    indexPath: options.indexPath ?? investigationIndexFileName,
    mode: options.mode
  });
}

export function investigationIndexDiagnosticMessages(
  diagnostics: readonly StateIndexDiagnostic[],
  displayPath: string = investigationIndexFileName
): string[] {
  return diagnostics.map((diagnostic) => {
    const source = diagnostic.path === null
      ? displayPath
      : diagnostic.path === investigationIndexFileName
        ? displayPath
        : diagnostic.path;
    return [
      source,
      diagnostic.stateId === null ? "" : `[${diagnostic.stateId}]`,
      diagnostic.message
    ].filter((part) => part.length > 0).join(" ");
  });
}

export function investigationSourceRevision(
  sources: readonly InvestigationSource[]
): string {
  const hash = createHash("sha256");
  hash.update("investigation-index-source-v1\0");
  for (const source of [...sources].sort((left, right) => compareText(
    left.path,
    right.path
  ))) {
    hashField(hash, source.path);
    hashField(hash, normalizeSourceText(source.text));
  }
  return `sha256:${hash.digest("hex")}`;
}

export async function readInvestigationSourceRevision(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<string> {
  return investigationSourceRevision(await readInvestigationSources(
    investigationsDirectory,
    signal
  ));
}

export async function readInvestigationStateSnapshot(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<StateSnapshot<InvestigationIndexState>> {
  const sources = await readInvestigationSources(
    investigationsDirectory,
    signal
  );
  const states = sources.map((source) => {
    const built = buildInvestigationTopicState(
      source.path,
      parseInvestigationReport(source.text, source.path)
    );
    if (built.state === null) {
      throw new Error(built.errors.join("; "));
    }
    return built.state;
  });
  return {
    revision: investigationSourceRevision(sources),
    states
  };
}

function parseInvestigationIndexState(input: Parameters<
  StateIndexDefinition<InvestigationIndexState>["parseState"]
>[0]): InvestigationIndexState {
  const parsed = v.safeParse(investigationIndexStateSchema, input);
  if (!parsed.success) {
    throw new TypeError(parsed.issues.map(formatStateIssue).join("; "));
  }
  if (parsed.output.reportCount !== parsed.output.reportTitles.length) {
    throw new TypeError(
      "reportCount must equal the number of reportTitles"
    );
  }
  return parsed.output;
}

async function readInvestigationSources(
  investigationsDirectory: string,
  signal?: AbortSignal
): Promise<InvestigationSource[]> {
  const stat = await fs.stat(investigationsDirectory);
  if (!stat.isDirectory()) {
    throw new Error(`${investigationsDirectory} must be a directory`);
  }
  const relativePaths = await discoverInvestigationTopicPaths(
    investigationsDirectory
  );
  const sources: InvestigationSource[] = [];
  for (
    let offset = 0;
    offset < relativePaths.length;
    offset += sourceReadConcurrency
  ) {
    if (signal?.aborted === true) {
      throw new Error("investigation source read was aborted");
    }
    const batch = relativePaths.slice(offset, offset + sourceReadConcurrency);
    sources.push(...await Promise.all(batch.map(async (relativePath) => ({
      path: relativePath,
      text: await fs.readFile(
        path.join(investigationsDirectory, ...relativePath.split("/")),
        "utf8"
      )
    }))));
  }
  return sources;
}

function stateIndexContext(
  root: string,
  signal: AbortSignal | undefined
): StateIndexContext {
  return {
    root,
    ...(signal === undefined ? {} : { signal })
  };
}

function formatStateIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath} ${issue.message}`;
}

function hashField(hash: ReturnType<typeof createHash>, value: string): void {
  hash.update(String(Buffer.byteLength(value, "utf8")));
  hash.update(":");
  hash.update(value, "utf8");
  hash.update("\0");
}

function normalizeSourceText(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
