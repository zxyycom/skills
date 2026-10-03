import type { CliRuntime } from "../src/cli.ts";

export const request = {
  state: { message: "no" },
  questions: { answer: { type: "noul", instructions: "rollback?" } }
} as const;

export function runtime(overrides: Partial<CliRuntime> = {}): CliRuntime {
  return {
    env: { OPENROUTER_API_KEY: "private-test-key" },
    home: "/not-user",
    readFile: async () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
    readStdin: async () => JSON.stringify(request),
    now: () => 10,
    fetch: async () =>
      new Response(
        JSON.stringify({
          model: "typesafe/jev-1.13-20260917",
          answers: { answer: { type: "noul", noul: 0.03 } },
          id: "test",
          provider: "typesafe",
          usage: { input_tokens: 7, output_tokens: 0, cost: 0.000001 }
        })
      ),
    ...overrides
  };
}

export const args: readonly string[] = [
  "json",
  "--json",
  JSON.stringify(request)
];
