import { appendFileSync } from "node:fs";
import { mock } from "node:test";

export type AuthenticationFixtureEvent = Readonly<
  | {
      kind: "gh";
      command: string;
      args: readonly string[];
      tokenOverridesCleared: boolean;
      timeout: number | undefined;
      nonInteractive: boolean;
    }
  | {
      kind: "request";
      url: string;
      authorization: string | null;
      accept: string | null;
    }
>;

export function recordAuthenticationEvent(
  event: AuthenticationFixtureEvent
): void {
  const logPath = process.env.SKILLS_TEST_AUTH_LOG;
  if (logPath) appendFileSync(logPath, `${JSON.stringify(event)}\n`);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing updater fixture environment: ${name}`);
  }
  return value;
}

const releaseJson = requiredEnvironment("SKILLS_TEST_RELEASE_JSON");
const manifestJson = requiredEnvironment("SKILLS_TEST_MANIFEST_JSON");
const zipBase64 = requiredEnvironment("SKILLS_TEST_ZIP_BASE64");
const fetchMarkerPath = process.env.SKILLS_TEST_FETCH_MARKER_PATH;

mock.method(
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
    recordAuthenticationEvent({
      kind: "request",
      url,
      authorization: headers.get("Authorization"),
      accept: headers.get("Accept")
    });
    if (fetchMarkerPath) appendFileSync(fetchMarkerPath, `${url}\n`);
    if (url.startsWith("https://api.github.com/repos/")) {
      return new Response(releaseJson, { status: 200 });
    }
    if (url === "https://example.test/skill-release-manifest.json") {
      return new Response(manifestJson, { status: 200 });
    }
    if (url === "https://example.test/ai-ready-docs.zip") {
      return new Response(Buffer.from(zipBase64, "base64"), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }
);
