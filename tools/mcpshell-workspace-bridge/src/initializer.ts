import process from "node:process";
import {
  agentProjectDirectoryFromSkillDirectory,
  isMainModule,
  skillDirectoryFromScriptUrl
} from "./shared.ts";
import { runInitializer } from "./initializer-run.ts";
import { readCliRequest } from "./initializer-cli.ts";
export { runInitializer } from "./initializer-run.ts";
export { readCliRequest } from "./initializer-cli.ts";
export type {
  InitializerAction,
  InitializerCommand,
  InitializerPaths,
  InitializerRequest,
  InitializerResult
} from "./initializer-contract.ts";

async function main(): Promise<void> {
  const skillDirectory = skillDirectoryFromScriptUrl(import.meta.url);
  const result = await runInitializer(readCliRequest(), {
    agentProjectDirectory:
      agentProjectDirectoryFromSkillDirectory(skillDirectory),
    skillDirectory
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
if (isMainModule(import.meta.url)) await main();
