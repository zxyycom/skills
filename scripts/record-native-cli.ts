import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparedRuntime, roles } from "./lib/record-native/runtime.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const role = process.argv[2];
if (role !== roles[0] && role !== roles[1] && role !== roles[2]) {
  process.stderr.write(
    "usage: record-native-cli.ts <decision-records|investigation-report|resource-records> [args...]\n"
  );
  process.exitCode = 1;
} else {
  try {
    const { paths } = await preparedRuntime(root, role);
    const child = spawn(paths[role], process.argv.slice(3), {
      stdio: "inherit"
    });
    const signals: NodeJS.Signals[] =
      process.platform === "win32"
        ? ["SIGINT", "SIGTERM"]
        : ["SIGINT", "SIGTERM", "SIGHUP"];
    const handlers = signals.map((signal) => {
      const handler = () => {
        child.kill(signal);
      };
      process.on(signal, handler);
      return { signal, handler };
    });
    child.on("error", (error) => {
      process.stderr.write(
        `record native runtime: ${error.message}; run bun run prepare:record-native\n`
      );
      process.exitCode = 1;
    });
    child.on("close", (code, signal) => {
      for (const handler of handlers)
        process.off(handler.signal, handler.handler);
      if (signal) process.kill(process.pid, signal);
      else process.exitCode = code ?? 1;
    });
  } catch (error) {
    process.stderr.write(
      `record native runtime: ${error instanceof Error ? error.message : String(error)}; run bun run prepare:record-native\n`
    );
    process.exitCode = 1;
  }
}
