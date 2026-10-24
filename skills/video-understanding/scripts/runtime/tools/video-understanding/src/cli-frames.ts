/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/cli-frames.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/cli-frames.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/cli-frames.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import path from "node:path";
import type { FrameOptions, LocatedOptions } from "./arguments.ts";
import {
  sameSource,
  readFileDigest,
  stableId,
  readSourceStamp,
  type FailedAttempt,
  type Evidence,
  type FrameEntry
} from "./evidence.ts";
import { boundaryFailure, failure, type VideoFailure } from "./failure.ts";
import {
  applicationRoot,
  interrupted,
  runtime,
  type ApplicationRootResolver,
  type Frame,
  type MediaInfo
} from "./media-runtime.ts";
import type { Snapshot } from "./refinement.ts";
import {
  operationDirectory,
  publishEvidence,
  publishFailureStatus,
  withWriter
} from "./store.ts";
import { recordedOperation, type OperationRun } from "./runs.ts";
import { createEvidenceParent, locateEvidence } from "./location.ts";
import type { VideoResources } from "./resources.ts";

function failedAttempt(mapped: VideoFailure): FailedAttempt {
  return {
    status: interrupted(mapped) ? "interrupted" : "failed",
    failure: mapped.failure
  };
}
function assertSource(
  snapshot: Snapshot,
  current: Awaited<ReturnType<typeof readSourceStamp>>
): void {
  if (!sameSource(snapshot.index.source, current))
    throw failure({
      kind: "inconsistent",
      stage: "verification",
      target: current.file,
      reason: "source changed during operation"
    });
}
function assertDuration(index: Evidence, duration: number): void {
  if (index.duration !== null && index.duration !== duration)
    throw failure({
      kind: "inconsistent",
      stage: "inspection",
      target: index.source.file,
      reason: "media duration changed"
    });
}
function frameResult(
  snapshot: Snapshot,
  options: LocatedOptions<FrameOptions>,
  reused: boolean,
  runId: string
): string {
  const mappings = options.times.map((time) => {
    const frame = snapshot.index.frames.entries.find(
      (entry) => entry.requested === time && entry.width === options.width
    );
    if (!frame)
      throw failure({
        kind: "program",
        stage: "frames",
        target: "published mapping",
        reason: "requested frame absent"
      });
    return { ...frame, path: path.join(options.output, frame.image.file) };
  });
  const result = {
    command: "frames",
    output: options.output,
    runId,
    scopeId: snapshot.index.scopeId,
    version: 5,
    reused,
    mappings
  };
  return options.format === "json"
    ? JSON.stringify(result)
    : [
        `scopeId=${result.scopeId} version=5 ${reused ? "reused" : "appended"} runId=${runId} output=${options.output}`,
        ...mappings.map(
          (frame) =>
            `${frame.id} requested=${frame.requested} actual=${frame.actual} pts=${frame.pts} timeBase=${frame.timeBase} stream=${frame.streamIndex} ${frame.path}`
        )
      ].join("\n");
}
function assertFrameRequest(
  index: Evidence,
  media: MediaInfo,
  times: readonly number[]
): void {
  assertDuration(index, media.duration);
  if (!media.streams.some((stream) => stream.type === "video"))
    throw failure({
      kind: "input",
      stage: "frames",
      target: index.source.file,
      reason: "media has no video stream"
    });
  if (times.some((time) => time >= media.duration))
    throw failure({
      kind: "input",
      stage: "frames",
      target: "times",
      reason: "frame time must be below media duration"
    });
}

type FrameRuntimeContext = Readonly<{
  resources: VideoResources;
  defaultAppRoot?: ApplicationRootResolver;
}>;

async function captureFrames(
  snapshot: Snapshot,
  options: LocatedOptions<FrameOptions>,
  times: number[],
  directory: string,
  environment: FrameRuntimeContext
): Promise<{ frames: readonly Frame[]; duration: number }> {
  const tools = await runtime({
    appRoot: await applicationRoot(
      environment.resources,
      options.appRoot,
      environment.defaultAppRoot
    ),
    output: directory,
    timeout: options.timeout,
    resources: environment.resources
  });
  const media = await tools.inspect(snapshot.index.source.file);
  assertFrameRequest(snapshot.index, media, times);
  const frames = await tools.frames({
    source: snapshot.index.source.file,
    times,
    width: options.width
  });
  if (
    frames.length !== times.length ||
    frames.some((frame, number) => frame.requested !== times[number])
  )
    throw failure({
      kind: "protocol",
      stage: "frames",
      target: directory,
      reason: "incomplete frame mapping"
    });
  assertSource(snapshot, await readSourceStamp(snapshot.index.source.file));
  return { frames, duration: media.duration };
}

async function generateFrames(
  snapshot: Snapshot,
  options: LocatedOptions<FrameOptions>,
  times: number[],
  run: OperationRun,
  environment: FrameRuntimeContext
): Promise<string> {
  const operation = await operationDirectory(options.output, run.id);
  try {
    const { frames, duration } = await captureFrames(
      snapshot,
      options,
      times,
      operation.directory,
      environment
    );
    const entries: FrameEntry[] = await Promise.all(
      frames.map(async (frame, number) => ({
        id: stableId("F", snapshot.index.frames.entries.length + number + 1),
        requested: frame.requested,
        actual: frame.actual,
        pts: frame.pts,
        timeBase: frame.timeBase,
        streamIndex: frame.streamIndex,
        width: options.width,
        image: await readFileDigest(
          options.output,
          `${operation.relative}/${frame.file}`
        )
      }))
    );
    const index = {
      ...snapshot.index,
      duration,
      frames: {
        entries: [...snapshot.index.frames.entries, ...entries],
        attempt: { status: "complete" as const }
      }
    };
    await publishEvidence(options.output, index);
    return frameResult({ ...snapshot, index }, options, false, run.id);
  } catch (error) {
    const mapped = boundaryFailure(error, {
      stage: "frames",
      target: operation.directory
    });
    await publishFailureStatus(options.output, {
      ...snapshot.index,
      frames: { ...snapshot.index.frames, attempt: failedAttempt(mapped) }
    });
    throw mapped;
  }
}
export async function extractFrames(
  requested: FrameOptions,
  resources: VideoResources,
  defaultAppRoot?: ApplicationRootResolver
): Promise<string> {
  const options = await locateEvidence(requested, resources);
  return recordedOperation(options, async (run) => {
    const source = await readSourceStamp(options.input);
    if (options.derivedOutput)
      await createEvidenceParent(options.output, options.evidenceRoot);
    return withWriter({
      output: options.output,
      source,
      onLocked: (index) => run.begin(index),
      work: async (snapshot) => {
        const damaged = snapshot.index.frames.entries.find(
          (frame) =>
            options.times.includes(frame.requested) &&
            frame.width === options.width &&
            snapshot.unavailable.has(frame.id)
        );
        if (damaged)
          throw failure({
            kind: "inconsistent",
            stage: "frames",
            target: damaged.id,
            reason:
              "saved frame unavailable; explicitly preserve/recover that artifact or choose another frame request"
          });
        const times = [...new Set(options.times)].filter(
          (time) =>
            !snapshot.index.frames.entries.some(
              (frame) =>
                frame.requested === time && frame.width === options.width
            )
        );
        if (!times.length) {
          run.markReused();
          return frameResult(snapshot, options, true, run.id);
        }
        return generateFrames(snapshot, options, times, run, {
          resources,
          defaultAppRoot
        });
      }
    });
  });
}
