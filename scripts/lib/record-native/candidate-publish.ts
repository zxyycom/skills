import type { NativeRole } from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { PublishedAsset } from "../publishing/publish-skills-types.ts";
import { prepareCandidatePublish } from "./candidate-publish-validation.ts";
import { candidateReleaseNotes } from "./candidate-publish-notes.ts";
import {
  publishRolling,
  publishSnapshot,
  type PublishContext
} from "./candidate-publish-flow.ts";
export type CandidatePublishInput = Readonly<{
  manifest: unknown;
  assets: readonly Readonly<{
    asset: Readonly<{ name: string; byteLength: number; sha256: string }>;
    bytes: Uint8Array;
  }>[];
  schemas: Readonly<Record<NativeRole, Uint8Array>>;
  provenance: Readonly<{
    pendingMatchesBase: boolean;
    pendingBaseRevision: string;
    buildRevision: string;
    sourceHash: string;
    sourceFiles: readonly string[];
    buildDeliveryHash: string;
    buildDeliveryFiles: readonly string[];
    recipeHashes: Readonly<Record<string, string>>;
    platforms: unknown;
  }>;
}>;
export type CandidatePublishAsset = Readonly<{
  name: string;
  bytes: Uint8Array;
  size: number;
  digest: string;
}>;
export type CandidatePublishRemote = Readonly<{
  readTag(tag: string): Promise<string | undefined>;
  readRelease(tag: string): Promise<readonly PublishedAsset[] | undefined>;
  readReleaseId(tag: string): Promise<number | undefined>;
  readNotes(tag: string): Promise<string | undefined>;
  updateNotes(tag: string, notes: string): Promise<void>;
  readLatest(): Promise<{ tag: string; id: number } | undefined>;
  markLatest(): Promise<void>;
  updateRollingTag(commit: string, old: string | undefined): Promise<void>;
  createRelease(
    tag: string,
    commit: string,
    assets: readonly CandidatePublishAsset[],
    rolling: boolean,
    notes: string
  ): Promise<void>;
  upload(
    tag: string,
    asset: CandidatePublishAsset,
    replace: boolean
  ): Promise<void>;
  deleteLegacy(
    name: "decision-records.zip" | "investigation-report.zip"
  ): Promise<void>;
}>;
export type CandidatePublishResult = Readonly<{
  status: "created" | "updated" | "unchanged" | "reused" | "failed";
  tag: string;
  target: string;
  oldTag?: string;
  phase: string;
  error?: string;
}>;

/** Validates every local byte before the first remote operation. No dist enumeration. */
export async function publishCandidateRelease(
  input: {
    release: CandidatePublishInput;
    mode: "rolling" | "snapshot";
    commit: string;
    packageHash: string;
  },
  remote: CandidatePublishRemote
): Promise<CandidatePublishResult> {
  const tag =
    input.mode === "rolling"
      ? "skills-latest"
      : `skills-${input.packageHash.slice(0, 12)}`;
  const context: PublishContext = {
    tag,
    commit: input.commit,
    remote,
    phase: "local validation",
    oldTag: undefined,
    notes: ""
  };
  try {
    if (
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(input.commit) ||
      !/^[a-f0-9]{64}$/.test(input.packageHash)
    )
      throw new Error("invalid commit or package hash");
    if (
      !input.release.provenance.pendingMatchesBase ||
      input.release.provenance.pendingBaseRevision !== input.commit
    )
      throw new Error(
        "candidate pending inputs are not the publication commit"
      );
    const prepared = prepareCandidatePublish(input.release);
    context.notes = candidateReleaseNotes(tag, prepared.assets);
    context.phase = "inspect release and tag";
    context.oldTag = await remote.readTag(tag);
    if (input.mode === "rolling")
      console.log(
        `Native rolling recovery boundary: old=${context.oldTag ?? "(absent)"} target=${input.commit}`
      );
    const existing = await remote.readRelease(tag);
    const status =
      input.mode === "snapshot"
        ? await publishSnapshot(context, prepared.assets, existing)
        : await publishRolling(
            context,
            prepared.assets,
            prepared.runtime,
            existing
          );
    return {
      status,
      tag,
      target: input.commit,
      oldTag: context.oldTag,
      phase: "complete"
    };
  } catch (error) {
    return {
      status: "failed",
      tag,
      target: input.commit,
      oldTag: context.oldTag,
      phase: context.phase,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
