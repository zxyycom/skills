import { createVideoCli } from "../../src/cli-entry.ts";

const runVideoCli = createVideoCli(
  new URL("../../resources/scripts/video.ts", import.meta.url)
);
await runVideoCli(process.argv.slice(2));
