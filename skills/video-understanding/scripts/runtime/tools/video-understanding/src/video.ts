/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/video.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/video.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/video.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseConfiguredOptions,
  type LogOptions,
  type Options,
  type PrepareOptions,
  type ReadOptions,
  type RefineOptions
} from "./arguments.ts";
import {
  readFileDigest,
  readSubtitleReferences,
  readSourceStamp,
  type Evidence
} from "./evidence.ts";
import {
  boundaryFailure,
  failure,
  parseJson,
  safeDiagnostic
} from "./failure.ts";
import type { ApplicationRootResolver } from "./media-runtime.ts";
import { formatQuery, queryEvidence } from "./query.ts";
import { parseDraft, refineRecord, targetRefs } from "./refinement.ts";
import {
  loadEvidence,
  loadSnapshot,
  localOutput,
  operationDirectory,
  publishEvidence,
  withWriter
} from "./store.ts";
import { latestSavedRun, queryRuns, recordedOperation } from "./runs.ts";
import {
  createEvidenceParent,
  localInput,
  locateEvidence
} from "./location.ts";
import { subtitleInputs } from "./text.ts";
import { generateText, prepareResult } from "./acquisition.ts";
import { reusablePreparation } from "./material.ts";
import { recognizeFrames } from "./frame-ocr.ts";
import { extractFrames } from "./cli-frames.ts";
import { readLocationConfiguration } from "./configuration.ts";
import type { VideoResources } from "./resources.ts";

export { extractFrames } from "./cli-frames.ts";

const help = `Local video evidence (Node 24.18+ or Bun; local Windows media runtime)
node scripts/video.ts prepare --input ABS [--output ABS|--evidence-root ABS] [--subtitle ABS|--subtitle-stream INDEX]
  [--source auto|external|embedded|asr|hard-ocr] [--fresh] [--region x,y,w,h]
  [--audio-stream INDEX] [--language CODE] [--model small] [--initial-prompt TEXT]
  [--app-root ABS] [--timeout SECONDS] [--format text|json]
node scripts/video.ts frames --input ABS [--output ABS|--evidence-root ABS] --times 3,3.2 [--width 960]
  [--app-root ABS] [--timeout SECONDS] [--format text|json]
node scripts/video.ts ocr (--input ABS [--evidence-root ABS]|--output ABS) --frames F0001,F0002
  [--region x,y,w,h] [--fresh] [--app-root ABS] [--timeout SECONDS] [--format text|json]
node scripts/video.ts read (--input ABS [--evidence-root ABS]|--output ABS) [--start 0] [--end SECONDS] [--limit 80]
  [--offset 0] [--view effective|raw|materials|calibrations] [--material M0001 (raw only)] [--format text|json]
node scripts/video.ts read (--input ABS [--evidence-root ABS]|--output ABS) --id T0001 [--revision N (S/C/D only)] [--format text|json]
node scripts/video.ts read (--input ABS [--evidence-root ABS]|--output ABS) --view calibrations [--offset 0] [--limit 80] [--format text|json]
node scripts/video.ts refine (--input ABS [--evidence-root ABS]|--output ABS) --file ABS [--format text|json]
node scripts/video.ts logs (--input ABS [--evidence-root ABS]|--output ABS) [--id RUN_UUID | --offset 0 --limit 80] [--format text|json]
Evidence requires --output ABS or --input ABS with --evidence-root ABS or config.json dataRoot. The selected evidence root derives <canonical video path SHA256>, no version directory.
User configuration is os.homedir()/.config/video-understanding/config.json; --config ABS selects an optional project JSON override for every command.
Both JSON files accept only optional appRoot/dataRoot (absolute local paths or null); omission/null inherits, and dataRoot uses its evidence/ child.
Explicit CLI locations override project config, then user config; repository adapter defaults are last. No cwd or media/data root is inferred.
Every existing configuration layer is validated even when overridden. User config may be absent; explicit project config must exist. CLI only reads configuration; --help skips it.
Media processing requires --app-root ABS or config.json appRoot; runtime existence is checked only for new media work.
--output overrides one video's evidence directory. Read/refine/logs require an explicit input or output, never a hidden current video.
--input resolves an existing local source; if it is missing, use the previously returned --output for logs.
Every response identifies output. M/T/F/O/S/C/D IDs are scoped by returned scopeId (format version 5).
refine JSON: {scopeId,action:"create",kind:"correction",targets:["T0001"],replacement:{segments:[{start:0,end:1,text:"..."}]},reason:"...",verified:{refs:[],note:"not verified"},support:["F0001"]}
Selection source: kind:"selection",mode:"source",material:"M0001",purpose:"transcript|subtitle|translation",reason,verified.
Selection authored: kind:"selection",mode:"authored",refs:["T0001"],text,purpose:"translation|narrative",reason,verified.
Support is optional (raw evidence only). Description refs: one F. Downstream summaries are not evidence records.
Update: action:"update", id, expectedRevision plus complete content. Revoke: action:"revoke", id, expectedRevision.
Correction replacement.segments=[] suppresses originals; revoke restores raw fallback. Description requires reason/verified too.
Auto uses external then embedded then ASR only when no usable text remains; actual errors stop. Explicit asr ignores subtitles.
Omit --language for automatic audio-language detection; set it only for a known spoken language. It is not inferred from titles/subtitles.
ASR requires an audio stream; absent audio fails with no processed coverage. Empty means a completed recognizer returned no text, not proven silence.
prepare/material detail languageMode is forced/detected/unknown; new successful ASR language is the tool result, parameters.language is the request (unknown means automatic).
Model-free historical ASR empty has unknown languageMode; its unchanged language field may be only the old request, not a recognizer result.
Fresh appends a new material; otherwise the latest current successful matching request is reused, including empty results.
Frames may precede text; new frames append IDs, requested+width reuses IDs; frames never run ASR.
Read loads evidence only; refine validates and saves supplied text. Neither loads images or runs models.
Read text uses compact ID/[start,end]/JSON-quoted transcript rows in raw/effective views; --format json or --id retains full item detail.
No overwrite of raw artifacts, automatic cleanup/migration, URL/UNC or non-zero/unknown media timeline.
Format version only identifies JSON. Unsupported versions fail without changing existing data; use a new explicit output for new evidence.
Media writes initialize absent or completely empty evidence directories; nonempty unknown directories are not adopted.
Concurrent/residual locks block writes; reads consume one published immutable-artifact snapshot.
Timeout 0 has no fixed deadline. Read budgets all selected items, not tokens; complete correction groups can exceed a window.
Associated IDs carry core metadata only. --id returns that ID's own content, including revoked content or an explicit unavailability.
materials/calibrations are paged catalogs without time windows. Multiple subtitle candidates require selection; one may appear as unadopted raw.
Read windows default to the exact duration when --end is omitted; an end up to 0.005 seconds above duration is clamped with a warning. Start is never clamped.
Unavailable S blocks adoption, while raw remains readable; unavailable C/D falls back to valid raw targets, with warnings.
logs lists saved runs; --id returns a full structured run and diagnostic paths, not diagnostic bodies.
running logs are unfinished records, not proof of a currently active process. Reads do not create logs.`;

export async function prepare(
  requested: PrepareOptions,
  resources: VideoResources,
  defaultAppRoot?: ApplicationRootResolver
): Promise<string> {
  const options = await locateEvidence(requested, resources);
  return recordedOperation(options, async (run) => {
    const input = options.input;
    const source = await readSourceStamp(input);
    const candidates = await subtitleInputs(options, input);
    const inputs = await readSubtitleReferences(candidates);
    if (options.derivedOutput)
      await createEvidenceParent(options.output, options.evidenceRoot);
    return withWriter({
      output: options.output,
      source,
      onLocked: (index) => run.begin(index),
      work: async (snapshot) => {
        const material = options.fresh
          ? undefined
          : reusablePreparation(snapshot, options, inputs);
        if (material) {
          run.markReused();
          return prepareResult(snapshot, material, true, options, run.id);
        }
        return generateText(snapshot, options, candidates, run, {
          resources,
          defaultAppRoot
        });
      }
    });
  });
}
function assertSelectedInput(index: Evidence, input?: string): void {
  if (input !== undefined && input !== index.source.file)
    throw failure({
      kind: "inconsistent",
      stage: "verification",
      target: input,
      reason: "selected input differs from this evidence directory's source"
    });
}
export async function readEvidence(
  requested: ReadOptions,
  resources: VideoResources
): Promise<string> {
  const options = await locateEvidence(requested, resources);
  const snapshot = await loadSnapshot(options.output);
  assertSelectedInput(snapshot.index, options.input);
  const result = queryEvidence(snapshot, options);
  const latestRun = await latestSavedRun(options.output, result.scopeId);
  return options.format === "json"
    ? JSON.stringify({ ...result, latestSavedRun: latestRun })
    : `${formatQuery(result, snapshot.index.materials)}\nlatest saved run (not necessarily latest invocation): ${JSON.stringify(latestRun)}`;
}
export async function refine(
  requested: RefineOptions,
  resources: VideoResources
): Promise<string> {
  const options = await locateEvidence(requested, resources);
  return recordedOperation(options, async (run) =>
    withWriter({
      output: options.output,
      onLocked: (index) => run.begin(index),
      work: async (snapshot) => {
        assertSelectedInput(snapshot.index, options.input);
        const target = await localInput(options.file);
        let draft;
        try {
          draft = parseDraft(
            parseJson(await readFile(target, "utf8"), {
              stage: "refine",
              target
            })
          );
        } catch (error) {
          throw boundaryFailure(error, { stage: "refine", target });
        }
        run.refinementParameters(draft);
        const record = refineRecord(draft, snapshot);
        const operation = await operationDirectory(options.output, run.id);
        const artifact = path.join(operation.directory, "refinement.json");
        try {
          await writeFile(artifact, JSON.stringify(record, null, 2), {
            flag: "wx"
          });
        } catch (error) {
          throw boundaryFailure(error, { stage: "refine", target: artifact });
        }
        const refs = targetRefs(record);
        const pointer = {
          id: record.id,
          kind: record.kind,
          revision: record.revision,
          state: record.state,
          refs,
          support: record.support,
          payload: await readFileDigest(
            options.output,
            `${operation.relative}/refinement.json`
          )
        };
        const previous = snapshot.index.refinements.find(
          (entry) => entry.id === record.id
        );
        const index = {
          ...snapshot.index,
          refinements: [
            ...snapshot.index.refinements.filter(
              (entry) => entry.id !== record.id
            ),
            pointer
          ],
          history: [...snapshot.index.history, ...(previous ? [previous] : [])]
        };
        await publishEvidence(options.output, index);
        const result = {
          command: "refine",
          output: options.output,
          runId: run.id,
          scopeId: index.scopeId,
          id: record.id,
          revision: record.revision,
          state: record.state,
          kind: record.kind,
          refs
        };
        return options.format === "json"
          ? JSON.stringify(result)
          : `scopeId=${result.scopeId} ${result.id} revision=${result.revision} ${result.state} kind=${result.kind} refs=${result.refs.join(",")} runId=${run.id} output=${options.output}`;
      }
    })
  );
}
export async function readLogs(
  requested: LogOptions,
  resources: VideoResources
): Promise<string> {
  const options = await locateEvidence(requested, resources);
  await localOutput(options.output);
  const index = await loadEvidence(options.output);
  assertSelectedInput(index, options.input);
  const result = {
    command: "logs",
    output: options.output,
    scopeId: index.scopeId,
    ...(await queryRuns(options, index.scopeId))
  };
  return options.format === "json"
    ? JSON.stringify(result)
    : JSON.stringify(result, null, 2);
}
export async function execute(
  options: Options,
  resources: VideoResources,
  defaultAppRoot?: ApplicationRootResolver
): Promise<string> {
  switch (options.command) {
    case "prepare":
      return prepare(options, resources, defaultAppRoot);
    case "read":
      return readEvidence(options, resources);
    case "frames":
      return extractFrames(options, resources, defaultAppRoot);
    case "ocr":
      return recognizeFrames(options, resources, defaultAppRoot);
    case "refine":
      return refine(options, resources);
    case "logs":
      return readLogs(options, resources);
  }
  const unreachable: never = options;
  throw new Error(`unreachable command ${String(unreachable)}`);
}
export type VideoCliDefaults = Readonly<{
  evidenceRoot?: string;
  appRoot?: ApplicationRootResolver;
}>;
export async function runVideoCli(
  argv: string[],
  resources: VideoResources,
  fallback: VideoCliDefaults = {}
): Promise<void> {
  try {
    const options = await parseConfiguredOptions(
      argv,
      async (projectConfigPath) => {
        const config = await readLocationConfiguration({
          userConfigPath: path.join(
            os.homedir(),
            ".config",
            "video-understanding",
            "config.json"
          ),
          projectConfigPath,
          resources
        });
        return {
          evidenceRoot:
            config.dataRoot === null
              ? fallback.evidenceRoot
              : path.join(config.dataRoot, "evidence"),
          appRoot: config.appRoot ?? undefined
        };
      }
    );
    console.log(
      options ? await execute(options, resources, fallback.appRoot) : help
    );
  } catch (error) {
    const reported = boundaryFailure(error, {
      stage: "arguments",
      target: "video CLI"
    });
    console.error(safeDiagnostic(reported.message));
    process.exitCode = 1;
  }
}
