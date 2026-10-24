/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/runs.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/runs.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/runs.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import type { LocatedOptions, LogOptions } from "./arguments.ts";
import type { Draft } from "./refinement.ts";
import type { Evidence } from "./evidence.ts";
import {
  boundaryFailure,
  errorCode,
  failure,
  parseJson,
  safeDiagnostic,
  validate,
  type Failure
} from "./failure.ts";
import {
  parameters,
  draftParameters,
  type WriteOptions
} from "./run-parameters.ts";
import {
  filenameFor,
  RunFilename,
  RunSchema,
  safeFailure,
  type RunRecord,
  type RunningRecord
} from "./run-record.ts";
export type { RunRecord } from "./run-record.ts";

function warn(error: unknown, output: string): void {
  const mapped = boundaryFailure(error, {
    stage: "output",
    target: path.join(output, "runs")
  });
  console.error(
    safeDiagnostic(
      `operation log unavailable; main result unchanged; no complete persisted run guarantee: ${mapped.message}`
    )
  );
}
/** One explicit write operation; recording is independent of evidence publication. */
export class OperationRun {
  readonly id = randomUUID();
  readonly startedAt = new Date().toISOString();
  private readonly options: WriteOptions;
  private session?: {
    record: RunningRecord;
    file: string;
    outcome: "complete" | "reused";
  };
  constructor(options: WriteOptions) {
    this.options = options;
  }
  async begin(index: Evidence): Promise<void> {
    const record: RunningRecord = {
      version: 1,
      runId: this.id,
      scopeId: index.scopeId,
      command: this.options.command,
      parameters: parameters(this.options),
      startedAt: this.startedAt,
      endedAt: null,
      status: "running",
      failure: null,
      artifacts: [],
      diagnostics: []
    };
    const file = path.join(
      this.options.output,
      "runs",
      filenameFor(this.startedAt, this.id)
    );
    this.session = { record, file, outcome: "complete" };
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(record, null, 2), { flag: "wx" });
    } catch (error) {
      warn(error, this.options.output);
    }
  }
  markReused(): void {
    if (this.session) this.session.outcome = "reused";
  }
  refinementParameters(draft: Draft): void {
    if (!this.session || this.options.command !== "refine") return;
    this.session.record.parameters = draftParameters(this.options.file, draft);
  }
  async finish(detail?: Failure): Promise<void> {
    if (!this.session) {
      console.error(
        "operation log not started: failure before a supported evidence root and exclusive writer were established; no persisted run guarantee"
      );
      return;
    }
    const { record, file, outcome } = this.session;
    const files = await this.artifactFiles();
    const final: RunRecord = {
      ...record,
      ...files,
      endedAt: new Date().toISOString(),
      ...(detail
        ? {
            status:
              detail.kind === "timeout" || detail.kind === "cancelled"
                ? "interrupted"
                : "failed",
            failure: safeFailure(detail)
          }
        : { status: outcome, failure: null })
    };
    const temporary = `${file}.pending`;
    try {
      await writeFile(temporary, JSON.stringify(final, null, 2), {
        flag: "wx"
      });
      await rename(temporary, file);
    } catch (error) {
      warn(error, this.options.output);
    } finally {
      try {
        await rm(temporary, { force: true });
      } catch (error) {
        warn(error, this.options.output);
      }
    }
  }
  private async artifactFiles(): Promise<
    Pick<RunRecord, "artifacts" | "diagnostics">
  > {
    const relative = `artifacts/${this.id}`;
    try {
      const entries = await readdir(path.join(this.options.output, relative), {
        recursive: true,
        withFileTypes: true
      });
      const files = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            !path
              .relative(
                path.join(this.options.output, relative),
                entry.parentPath
              )
              .split(path.sep)
              .includes(".process")
        )
        .map((entry) =>
          path
            .relative(
              this.options.output,
              path.join(entry.parentPath, entry.name)
            )
            .split(path.sep)
            .join("/")
        )
        .sort();
      return {
        artifacts: files.filter(
          (file) => !path.basename(file).startsWith("diagnostic-")
        ),
        diagnostics: files.filter((file) =>
          /^diagnostic-\d+\.log$/.test(path.basename(file))
        )
      };
    } catch (error) {
      if (errorCode(error) !== "ENOENT") warn(error, this.options.output);
      return { artifacts: [], diagnostics: [] };
    }
  }
}
export async function recordedOperation(
  options: WriteOptions,
  work: (run: OperationRun) => Promise<string>
): Promise<string> {
  const run = new OperationRun(options);
  try {
    const result = await work(run);
    await run.finish();
    return result;
  } catch (error) {
    const mapped = boundaryFailure(error, {
      stage: options.command === "refine" ? "refine" : "input",
      target: options.output
    });
    await run.finish(mapped.failure);
    throw mapped;
  }
}
async function runFiles(output: string): Promise<string[]> {
  try {
    return (await readdir(path.join(output, "runs")))
      .filter((file) => RunFilename.test(file))
      .sort()
      .reverse();
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw boundaryFailure(error, {
      stage: "read",
      target: path.join(output, "runs")
    });
  }
}
async function readRun(output: string, file: string, scopeId: string) {
  const target = path.join(output, "runs", file);
  try {
    const record = validate(
      RunSchema,
      parseJson(await readFile(target, "utf8"), { stage: "read", target }),
      { stage: "read", target }
    );
    if (
      record.scopeId !== scopeId ||
      filenameFor(record.startedAt, record.runId) !== file ||
      [...record.artifacts, ...record.diagnostics].some(
        (item) => !item.startsWith(`artifacts/${record.runId}/`)
      ) ||
      record.diagnostics.some(
        (item) => !/^diagnostic-\d+\.log$/.test(path.basename(item))
      )
    ) {
      throw failure(
        {
          kind: "protocol",
          stage: "read",
          target,
          reason: "run scope, filename or artifact identity mismatch"
        },
        "preserve the saved log and inspect its declared scope, filename and artifact paths"
      );
    }
    return { availability: "available" as const, path: target, record };
  } catch (error) {
    const detail = boundaryFailure(error, { stage: "read", target }).failure;
    return {
      availability: "invalid" as const,
      path: target,
      runId: RunFilename.exec(file)?.[1] ?? null,
      reason: detail.reason
    };
  }
}
export async function latestSavedRun(output: string, scopeId: string) {
  try {
    const file = (await runFiles(output))[0];
    if (!file)
      return {
        availability: "missing" as const,
        meaning: "no saved operation log",
        directory: path.join(output, "runs")
      };
    const loaded = await readRun(output, file, scopeId);
    if (loaded.availability === "invalid") return loaded;
    const { runId, command, startedAt, endedAt, status, failure } =
      loaded.record;
    return {
      availability: "available" as const,
      meaning: "latest saved run, not necessarily latest CLI invocation",
      runId,
      command,
      startedAt,
      endedAt,
      status,
      failure: failure ? { kind: failure.kind, stage: failure.stage } : null,
      path: loaded.path
    };
  } catch (error) {
    return {
      availability: "invalid" as const,
      reason: boundaryFailure(error, {
        stage: "read",
        target: path.join(output, "runs")
      }).failure.reason
    };
  }
}
export async function queryRuns(
  options: LocatedOptions<LogOptions>,
  scopeId: string
) {
  const files = await runFiles(options.output);
  if (options.id) {
    const file = files.find(
      (file) => RunFilename.exec(file)?.[1] === options.id
    );
    return {
      requestedId: options.id,
      items: file
        ? [await readRun(options.output, file, scopeId)]
        : [
            {
              availability: "missing" as const,
              runId: options.id,
              reason: "run ID not saved in this root"
            }
          ],
      nextOffset: null
    };
  }
  const selected = files.slice(options.offset, options.offset + options.limit);
  return {
    offset: options.offset,
    total: files.length,
    items: await Promise.all(
      selected.map(async (file) => {
        const loaded = await readRun(options.output, file, scopeId);
        if (loaded.availability !== "available") return loaded;
        const { runId, command, startedAt, endedAt, status } = loaded.record;
        return {
          availability: "available" as const,
          path: loaded.path,
          runId,
          command,
          startedAt,
          endedAt,
          status
        };
      })
    ),
    nextOffset:
      options.offset + selected.length < files.length
        ? options.offset + selected.length
        : null
  };
}
