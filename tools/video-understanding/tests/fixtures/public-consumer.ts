import {
  VideoFailure,
  runVideoCli,
  type Failure,
  type VideoCliDefaults
} from "../../../../skills/video-understanding/scripts/video.ts";

// Compiled by the workspace typecheck; this fixture is never executed.
export const consumerRunner: (
  argv: string[],
  defaults?: { evidenceRoot?: string; appRoot?: () => Promise<string> }
) => Promise<void> = runVideoCli;

export function consumerFailure(details: Failure): VideoFailure {
  return new VideoFailure(details);
}

export const consumerDefaults: VideoCliDefaults = {
  evidenceRoot: "C:/isolated-fixture/evidence",
  appRoot: async () => "C:/isolated-fixture/media"
};
