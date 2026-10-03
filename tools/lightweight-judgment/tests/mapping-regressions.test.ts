import assert from "node:assert/strict";
import test from "node:test";
import { runCli, type CliRuntime } from "../src/cli.ts";
import { validateRequest, validateModel } from "../src/request.ts";
import { validateResponse } from "../src/response.ts";
import { parseJson, stringifyJson } from "../src/json.ts";
import { decodeSuccess, decodeFailure, parseObject, object } from "./output.ts";

const model = validateModel("typesafe/jev-test", "input", "fixture.model");

const names = ["__proto__", "constructor", "prototype"];

function rt(
  env: CliRuntime["env"] = { OPENROUTER_API_KEY: "fixture-key" }
): CliRuntime {
  return {
    env,
    home: "/fixture",
    readFile: async () => "{}",
    readStdin: async () => "",
    now: () => 1,
    fetch: async () => {
      throw new Error("must not fetch");
    }
  };
}
test("own prototype-named question candidate and structured keys survive native serialization", async () => {
  const source =
    '{"state":{"__proto__":{"constructor":"data"},"prototype":["native"]},"questions":{"constructor":{"type":"choice","instructions":{"__proto__":"instruction"},"criteria":{"__proto__":"P","constructor":{"prototype":"C"},"prototype":null}},"__proto__":{"type":"noul","instructions":"yes?"}}}';
  const req = validateRequest(parseJson(source), undefined, model);
  const sent = stringifyJson(req);
  const expected = { ...parseObject(source), model };
  assert.deepEqual(parseObject(sent), expected);
  const response =
    '{"model":"typesafe/jev-test","answers":{"constructor":{"type":"choice","choice":"__proto__","confidence":0.1,"probabilities":{"__proto__":0.5,"constructor":0.3,"prototype":0.2}},"__proto__":{"type":"noul","noul":0.5}},"usage":{"__proto__":"preserved"}}';
  assert.deepEqual(
    parseObject(stringifyJson(validateResponse(response, req))),
    parseObject(response)
  );
  for (const name of names) {
    const raw = `{"state":"s","questions":{"a":{"type":"choice","instructions":"pick","criteria":{"${name}":true,"normal":"N"}}}}`;
    assert.throws(() => validateRequest(parseJson(raw), undefined, model));
    const dry = await runCli(
      [
        "ask",
        "--type",
        "choice",
        "--question",
        "pick",
        "--text",
        "s",
        "--option",
        `${name}=candidate`,
        "--dry-run"
      ],
      rt()
    );
    assert.equal(dry.exitCode, 0);
    assert.equal(
      object(
        object(
          object(object(decodeSuccess(dry.stdout).result.request).questions)
            .answer
        ).criteria
      )[name],
      "candidate"
    );
  }
});
test("extra prototype-named response probability and legend keys cannot evade validation", () => {
  const choice = validateRequest(
    parseJson(
      '{"state":"s","questions":{"a":{"type":"choice","instructions":"pick","criteria":{"normal":"N"}}}}'
    ),
    undefined,
    model
  );
  const score = validateRequest(
    parseJson(
      '{"state":"s","questions":{"a":{"type":"score","instructions":"score","criteria":["low","high"]}}}'
    ),
    undefined,
    model
  );
  for (const name of names) {
    for (const value of ["0", "0.2", "true", '"0.2"', "null", "{}"]) {
      const probabilities = `{"normal":1,"${name}":${value}}`;
      assert.throws(() =>
        validateResponse(
          `{"model":"${model}","answers":{"a":{"type":"choice","choice":"normal","confidence":1,"probabilities":${probabilities}}}}`,
          choice
        )
      );
      assert.throws(() =>
        validateResponse(
          `{"model":"${model}","answers":{"a":{"type":"score","score":0.5,"confidence":0,"probabilities":{"0":0.5,"1":0.5,"${name}":${value}},"legend":{"0":"low","1":"high"}}}}`,
          score
        )
      );
      assert.throws(() =>
        validateResponse(
          `{"model":"${model}","answers":{"a":{"type":"score","score":0.5,"confidence":0,"probabilities":{"0":0.5,"1":0.5},"legend":{"0":"low","1":"high","${name}":${value}}}}`,
          score
        )
      );
    }
  }
});
test("unknown prototype-named fields are rejected at configuration request and question boundaries", async () => {
  const base =
    '{"state":"s","questions":{"a":{"type":"noul","instructions":"yes?"}}}';
  for (const name of names) {
    const invalid = [
      base.replace('"state"', `"${name}":"extra","state"`),
      base.replace('"type"', `"${name}":"extra","type"`),
      base.replace(
        '"instructions":"yes?"',
        `"instructions":"yes?","criteria":{"${name}":"extra"}`
      )
    ];
    for (const source of invalid)
      assert.throws(() => validateRequest(parseJson(source), undefined, model));
    const config = await runCli(["json", "--json", base, "--dry-run"], {
      ...rt(),
      readFile: async () => `{"${name}":"extra"}`
    });
    assert.equal(config.exitCode, 2);
    assert.equal(decodeFailure(config.stdout).error.kind, "configuration");
  }
  assert.equal(
    (await runCli(["doctor"], { ...rt(), readFile: async () => "[]" }))
      .exitCode,
    2
  );
});
test("missing or blank local key is configuration failure before doctor or inference sends", async () => {
  let calls = 0;
  for (const key of [undefined, "", " \t\n"]) {
    const runtime = {
      ...rt({ OPENROUTER_API_KEY: key }),
      fetch: async () => {
        calls++;
        throw new Error("sent");
      }
    };
    for (const args of [
      ["doctor"],
      [
        "json",
        "--json",
        '{"state":"s","questions":{"a":{"type":"noul","instructions":"yes?"}}}'
      ]
    ]) {
      const outcome = await runCli(args, runtime);
      assert.equal(outcome.exitCode, 2);
      const output = decodeFailure(outcome.stdout);
      assert.equal(output.error.kind, "configuration");
      assert.equal(output.meta.attempts, 0);
      assert.equal(output.result, null);
    }
  }
  assert.equal(calls, 0);
});
