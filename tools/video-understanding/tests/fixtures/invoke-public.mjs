import { pathToFileURL } from "node:url";

const { runVideoCli, VideoFailure } = await import(
  pathToFileURL(process.argv[2]).href
);
let calls = 0;
const value = await runVideoCli(process.argv.slice(3), {
  evidenceRoot: process.env.VIDEO_TEST_EVIDENCE_ROOT,
  appRoot: async () => {
    calls++;
    if (process.env.VIDEO_TEST_THROW_APP) {
      throw new VideoFailure({
        kind: "environment",
        stage: "runtime",
        target: process.env.VIDEO_TEST_APP_ROOT,
        reason: "fixture resolver failure",
        action: "fixture recovery"
      });
    }
    return process.env.VIDEO_TEST_APP_ROOT;
  }
});
process.stderr.write(`fixture:return=${String(value)};resolver=${calls}\n`);
