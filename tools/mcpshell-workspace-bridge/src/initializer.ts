import process from "node:process";
import {
  agentProjectDirectoryFromSkillDirectory,
  isMainModule,
  skillDirectoryFromScriptUrl
} from "./shared.ts";
import { runInitializer } from "./initializer/initializer-run.ts";
import { readCliRequest } from "./initializer/initializer-cli.ts";
export { runInitializer } from "./initializer/initializer-run.ts";
export { readCliRequest } from "./initializer/initializer-cli.ts";
export type {
  InitializerAction,
  InitializerCommand,
  InitializerPaths,
  InitializerRequest,
  InitializerResult
} from "./initializer/initializer-contract.ts";

export async function runInitializerCli(
  scriptUrl: string = import.meta.url
): Promise<void> {
  const skillDirectory = skillDirectoryFromScriptUrl(scriptUrl);
  const result = await runInitializer(readCliRequest(), {
    agentProjectDirectory:
      agentProjectDirectoryFromSkillDirectory(skillDirectory),
    skillDirectory
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
if (isMainModule(import.meta.url)) await runInitializerCli();
