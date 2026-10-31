import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  EvidenceSchema,
  isRecord,
  sameSource,
  readSourceStamp,
  type Evidence,
  type SourceStamp
} from "../evidence/evidence.ts";
import {
  boundaryFailure,
  errorCode,
  failure,
  parseJson,
  safeDiagnostic,
  validate
} from "../failure.ts";
import type { Snapshot } from "../refinement/refinement.ts";
import { checkManifest } from "./store-manifest.ts";
import { materialSnapshot, rawAvailability } from "./store-artifacts.ts";
import { secondary, validateCalibrations } from "./store-refinements.ts";
import {
  localOutput,
  openDirectory,
  releaseLock,
  reportCleanupFailure
} from "./store-writer.ts";
export { localOutput } from "./store-writer.ts";

export async function loadEvidence(output: string): Promise<Evidence> {
  const target = path.join(output, "evidence.json");
  try {
    const value = parseJson(await readFile(target, "utf8"), {
      stage: "manifest",
      target
    });
    if (isRecord(value) && value.version !== 5)
      throw failure(
        {
          kind: "protocol",
          stage: "manifest",
          target,
          reason:
            "unsupported evidence version; expected 5; old files left unchanged"
        },
        "preserve existing data; use a new explicit output for new evidence"
      );
    const index = validate(EvidenceSchema, value, {
      stage: "manifest",
      target
    });
    checkManifest(index);
    return index;
  } catch (error) {
    throw boundaryFailure(error, { stage: "manifest", target });
  }
}
export async function publishEvidence(
  output: string,
  index: Evidence
): Promise<void> {
  const target = path.join(output, "evidence.json");
  const temporary = path.join(output, `.index-${randomUUID()}.json`);
  let failed = false;
  try {
    validate(EvidenceSchema, index, { stage: "publish", target });
    checkManifest(index);
    await writeFile(temporary, JSON.stringify(index, null, 2), { flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    failed = true;
    throw boundaryFailure(error, { stage: "publish", target });
  } finally {
    try {
      await rm(temporary, { force: true });
    } catch (error) {
      reportCleanupFailure(
        failed,
        boundaryFailure(error, { stage: "publish", target: temporary })
      );
    }
  }
}
export async function publishFailureStatus(
  output: string,
  index: Evidence
): Promise<void> {
  try {
    await publishEvidence(output, index);
  } catch (error) {
    const publication = boundaryFailure(error, {
      stage: "publish",
      target: path.join(output, "evidence.json")
    });
    console.error(
      safeDiagnostic(
        `failure status publication failed; primary error retained: ${publication.message}; published status may be unchanged; preserve artifacts and inspect output permissions before retrying`
      )
    );
  }
}
export async function loadSnapshot(
  output: string,
  index?: Evidence
): Promise<Snapshot> {
  await localOutput(output);
  const evidence = index ?? (await loadEvidence(output));
  if (!sameSource(evidence.source, await readSourceStamp(evidence.source.file)))
    throw failure({
      kind: "inconsistent",
      stage: "verification",
      target: output,
      reason: "stale evidence: source changed"
    });
  checkManifest(evidence);
  const materials = await Promise.all(
    evidence.materials.map((material) => materialSnapshot(output, material))
  );
  const unavailable = await rawAvailability(output, evidence, materials);
  const observations = materials.flatMap((m) => m.observations);
  const records = await Promise.all(
    evidence.refinements.map((pointer) =>
      secondary(output, pointer, evidence.scopeId)
    )
  );
  const history = await Promise.all(
    evidence.history.map((pointer) =>
      secondary(output, pointer, evidence.scopeId)
    )
  );
  const snapshot: Snapshot = {
    index: evidence,
    transcripts: materials.flatMap((m) => m.transcripts),
    observations,
    materials,
    unavailable,
    records,
    history
  };
  validateCalibrations(snapshot);
  return snapshot;
}
export function freshEvidence(source: SourceStamp): Evidence {
  return {
    version: 5,
    scopeId: randomUUID(),
    source,
    duration: null,
    materials: [],
    frames: { entries: [], attempt: { status: "unprepared" } },
    refinements: [],
    history: []
  };
}
export async function withWriter<T>({
  output,
  source,
  work,
  onLocked
}: {
  output: string;
  source?: SourceStamp;
  work: (snapshot: Snapshot) => Promise<T>;
  onLocked?: (index: Evidence) => Promise<void>;
}): Promise<T> {
  const created = await openDirectory(output, source);
  const lockFile = path.join(output, ".write-lock");
  let lock;
  let failed = false;
  try {
    lock = await open(lockFile, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST")
      throw failure(
        {
          kind: "inconsistent",
          stage: "lock",
          target: output,
          reason: "writer or residual lock present"
        },
        "wait for the writer; do not automatically delete the lock"
      );
    throw boundaryFailure(error, { stage: "lock", target: output });
  }
  try {
    if (
      created &&
      (await readdir(output)).some((name) => name !== ".write-lock")
    ) {
      throw failure(
        {
          kind: "inconsistent",
          stage: "output",
          target: output,
          reason: "initialization directory is no longer empty"
        },
        "preserve files and inspect concurrent changes before retrying"
      );
    }
    const index =
      created && source ? freshEvidence(source) : await loadEvidence(output);
    await onLocked?.(index);
    if (source && !sameSource(index.source, source))
      throw failure({
        kind: "inconsistent",
        stage: "verification",
        target: output,
        reason: "stale evidence: different source"
      });
    if (created) await publishEvidence(output, index);
    return await work(await loadSnapshot(output, index));
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    await releaseLock(lock, lockFile, failed);
  }
}
export async function operationDirectory(
  output: string,
  id = randomUUID()
): Promise<{ directory: string; relative: string }> {
  const relative = `artifacts/${id}`;
  const directory = path.join(output, relative);
  const artifacts = path.join(output, "artifacts");
  try {
    await mkdir(artifacts, { recursive: true });
  } catch (error) {
    throw boundaryFailure(error, { stage: "output", target: artifacts });
  }
  try {
    await mkdir(directory);
  } catch (error) {
    throw boundaryFailure(error, { stage: "output", target: directory });
  }
  return { directory, relative };
}
