import assert from "node:assert/strict";
import childProcess, {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns
} from "node:child_process";
import { mock } from "node:test";
import type { AuthenticationFixtureEvent } from "./fixtures/mock-fetch.ts";
import { validManifest, validRelease, zipData } from "./support.ts";

export type AuthenticationScenario = Readonly<{
  env?: Readonly<NodeJS.ProcessEnv>;
  errorCode?: string;
  status?: number;
  stdout?: string;
  httpStatus?: number;
}>;

type AuthenticationObservations = Readonly<{
  events: readonly AuthenticationFixtureEvent[];
  output: readonly string[];
  warnings: readonly string[];
}>;

export function assertNoCredentialsLogged(output: string): void {
  assert.doesNotMatch(
    output,
    /fixture-(?:gh-token|github-token|env-token|subprocess-secret)/u
  );
}

export async function withAuthenticationScenario(
  scenario: AuthenticationScenario,
  run: (observations: AuthenticationObservations) => void | Promise<void>
): Promise<void> {
  const originalEnvironment = process.env;
  process.env = {
    ...originalEnvironment,
    GITHUB_TOKEN: "",
    GH_TOKEN: "",
    GH_HOST: "enterprise.example.test",
    ...scenario.env
  };
  const events: AuthenticationFixtureEvent[] = [];
  const output: string[] = [];
  const warnings: string[] = [];
  const observations: AuthenticationObservations = { events, output, warnings };
  const gh = mock.method(
    childProcess,
    "spawnSync",
    (
      command: string,
      args: readonly string[],
      options: SpawnSyncOptionsWithStringEncoding
    ): SpawnSyncReturns<string> => {
      events.push({
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
      const token = scenario.stdout ?? " fixture-gh-token\n";
      return {
        pid: 0,
        status:
          scenario.errorCode === undefined ? (scenario.status ?? 0) : null,
        signal: null,
        stdout: token,
        stderr: "fixture-subprocess-secret",
        output: [null, token, "fixture-subprocess-secret"],
        error:
          scenario.errorCode === undefined
            ? undefined
            : Object.assign(new Error("fixture-subprocess-secret"), {
                code: scenario.errorCode
              })
      };
    }
  );
  const fetch = mock.method(
    globalThis,
    "fetch",
    async (
      input: Parameters<typeof globalThis.fetch>[0],
      options?: Parameters<typeof globalThis.fetch>[1]
    ): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const headers = new Headers(options?.headers);
      events.push({
        kind: "request",
        url,
        authorization: headers.get("Authorization"),
        accept: headers.get("Accept")
      });
      if (scenario.httpStatus !== undefined) {
        return new Response("fixture authentication failure", {
          status: scenario.httpStatus
        });
      }
      if (url.startsWith("https://api.github.com/repos/"))
        return new Response(JSON.stringify(validRelease));
      if (url === validRelease.assets[0].url)
        return new Response(JSON.stringify(validManifest));
      if (url === validRelease.assets[1].url)
        return new Response(Buffer.from(zipData));
      return new Response("not found", { status: 404 });
    }
  );
  const log = mock.method(console, "log", (...values: unknown[]) => {
    output.push(values.map(String).join(" "));
  });
  const warn = mock.method(console, "warn", (...values: unknown[]) => {
    warnings.push(values.map(String).join(" "));
  });
  try {
    await run(observations);
    assertNoCredentialsLogged(
      [...observations.output, ...observations.warnings].join("\n")
    );
  } finally {
    gh.mock.restore();
    fetch.mock.restore();
    log.mock.restore();
    warn.mock.restore();
    process.env = originalEnvironment;
  }
}
