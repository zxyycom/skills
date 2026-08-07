import { installTaskGraphRuntime } from "../src/runtime.ts";
import { copyRootNativePackages } from "./helpers.ts";

const toolHome = process.argv[2];
if (toolHome === undefined) throw new Error("tool home argument is required");
const result = await installTaskGraphRuntime({
  environment: { TASK_GRAPH_TOOL_HOME: toolHome },
  nodeVersion: process.version,
  commandRunner: async ({ cwd }) => await copyRootNativePackages(cwd)
});
process.stdout.write(`${JSON.stringify(result)}\n`);
