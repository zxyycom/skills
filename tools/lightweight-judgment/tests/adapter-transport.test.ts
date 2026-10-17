import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { parseJson, stringifyJson } from "../src/json.ts";
import {
  configured,
  input,
  image,
  typesafe,
  router
} from "./adapter-fixture.ts";
import { array } from "./statistics-fixture.ts";
import { object, decodeSuccess } from "./output.ts";

test("selected adapters send their own credentials headers and native wire without cross protocol fallback", async () => {
  for (const config of [
    { ...typesafe, images: true, longContext: true },
    { ...router, images: true, longContext: true },
    { ...router, model: "openai/gpt-6-luna-decisions", images: true }
  ]) {
    const isNative = config.adapter === "typesafe";
    const source = config.model.startsWith("openai/")
      ? input({ photo: image() })
      : input(
          { photo: image() },
          {
            score: {
              type: "score",
              instructions: "rate",
              criteria: [{ photo: image(), label: "low" }, { label: "high" }]
            }
          }
        );
    let sent = 0;
    const result = await runCli(
      ["json", "--json", source],
      configured(config, {
        fetch: async (url, init) => {
          sent++;
          assert.equal(url, config.endpoint);
          assert.equal(init.redirect, "manual");
          assert.equal(init.method, "POST");
          const headers = new Headers(init.headers);
          assert.equal(
            headers.get("Authorization"),
            isNative ? "Bearer typesafe-key" : "Bearer router-key"
          );
          assert.equal(headers.get("Content-Type"), "application/json");
          assert.equal(
            headers.get("TypeSafe-Danger-Zone-Images"),
            isNative ? "true" : null
          );
          assert.equal(
            headers.get("TypeSafe-Danger-Zone-Long-Context"),
            isNative ? "true" : null
          );
          assert.ok(typeof init.body === "string");
          const raw: unknown = JSON.parse(init.body);
          const wire = object(raw);
          assert.ok(object(wire.questions));
          assert.equal(Object.hasOwn(wire, "input"), false);
          if (config.model.startsWith("openai/"))
            return new Response(
              JSON.stringify({
                model: "openai/gpt-6-luna-decisions",
                answers: { answer: { type: "noul", noul: 0.7 } },
                usage: { input_tokens: 4, output_tokens: 0 }
              })
            );
          const rubric = array(object(object(wire.questions).score).criteria);
          return new Response(
            JSON.stringify({
              model: isNative ? "jev-1.14.0" : "typesafe/jev-1.14-20261014",
              answers: {
                score: {
                  type: "score",
                  score: 0.8,
                  confidence: 0.3,
                  probabilities: { "0": 0.2, "1": 0.8 },
                  legend: { "0": rubric[0], "1": rubric[1] }
                }
              },
              usage: { input_tokens: 4, output_tokens: 0 }
            })
          );
        }
      })
    );
    assert.equal(result.exitCode, 0, result.stdout);
    assert.equal(sent, 1);
    const normalized = object(decodeSuccess(result.stdout).normalized);
    assert.equal(normalized.completion, "complete");
    if (isNative) {
      const score = object(object(normalized.answers).score);
      assert.ok(
        stringifyJson(parseJson(JSON.stringify(score.requestRubric))).includes(
          "data:image/png;base64,"
        )
      );
      assert.equal(JSON.stringify(score.legend).includes("data:image"), false);
    }
  }
});
