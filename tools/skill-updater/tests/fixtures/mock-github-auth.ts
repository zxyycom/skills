import childProcess, {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns
} from "node:child_process";
import { mock } from "node:test";
import { recordAuthenticationEvent } from "./mock-fetch.ts";

mock.method(
  childProcess,
  "spawnSync",
  (
    command: string,
    args: readonly string[],
    options: SpawnSyncOptionsWithStringEncoding
  ): SpawnSyncReturns<string> => {
    recordAuthenticationEvent({
      kind: "gh",
      command,
      args,
      tokenOverridesCleared:
        options.env !== undefined &&
        options.env.GITHUB_TOKEN === undefined &&
        options.env.GH_TOKEN === undefined,
      timeout: options.timeout,
      nonInteractive:
        Array.isArray(options.stdio) && options.stdio[0] === "ignore"
    });
    const token =
      options.env?.GH_TOKEN ||
      options.env?.GITHUB_TOKEN ||
      " fixture-gh-token\n";
    return {
      pid: 0,
      status: 0,
      signal: null,
      stdout: token,
      stderr: "fixture-subprocess-secret",
      output: [null, token, "fixture-subprocess-secret"]
    };
  }
);
