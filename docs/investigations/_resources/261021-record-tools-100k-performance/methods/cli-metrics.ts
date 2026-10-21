import { performance } from "node:perf_hooks";
const started = performance.now();
process.on("exit", () => {
  process.stderr.write(
    "\nPERF_METRICS " +
      JSON.stringify({
        elapsedMs: performance.now() - started,
        maxRssKiB: process.resourceUsage().maxRSS,
        cpu: process.cpuUsage()
      }) +
      "\n"
  );
});
