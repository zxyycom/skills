import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { parseJson, record, stringifyJson } from "../src/json.ts";
import { logFixture } from "./log-fixture.ts";
import { runtime } from "./runtime-fixture.ts";
import { decodeFailure, decodeSuccess, object } from "./output.ts";

function pngChunk(name: string, data: Buffer): Buffer {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length);
  result.write(name, 4, "ascii");
  data.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
function pngFixture(width: number, height: number, textLength = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(height * (width * 3 + 1));
  let random = 0x13579bdf;
  for (let row = 0; row < height; row++) {
    for (let column = 1; column <= width * 3; column++) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      pixels[row * (width * 3 + 1) + column] = random & 255;
    }
  }
  const compressed = deflateSync(pixels);
  const bytes = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("tEXt", Buffer.from(`fixture\0${"x".repeat(textLength)}`)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
  return { bytes, compressed, pixels };
}
function imageRequest(base64: string): string {
  return JSON.stringify({
    state: {
      type: "image_url",
      image_url: { url: `data:image/png;base64,${base64}` }
    },
    questions: {
      answer: { type: "noul", instructions: "Is there a visible target?" }
    }
  });
}
function imageRuntime() {
  return runtime({
    env: {},
    readFile: async () =>
      JSON.stringify({
        adapter: "typesafe",
        endpoint: "https://not-called.invalid/v1/systemone",
        model: "jev-1.14.0",
        apiKeyEnv: "UNSET_FIXTURE_KEY",
        images: true
      }),
    fetch: async () => assert.fail("offline image validation must not fetch")
  });
}

test("Node standalone accepts large canonical inline PNG without regex stack overflow", () => {
  const fixture = logFixture();
  try {
    const png = pngFixture(1200, 1200);
    assert.ok(png.bytes.length > 4 * 1024 * 1024);
    assert.ok(png.bytes.length < 16 * 1024 * 1024);
    assert.deepEqual(inflateSync(png.compressed), png.pixels);
    const base64 = png.bytes.toString("base64");
    assert.ok(base64.length > 5_000_000);
    const entry = path.join(fixture.directory, "judgment.mjs");
    fs.copyFileSync(
      new URL(
        "../../../skills/lightweight-judgment/scripts/lightweight-judgment.mjs",
        import.meta.url
      ),
      entry
    );
    const config = path.join(fixture.directory, "config.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        adapter: "typesafe",
        endpoint: "https://not-called.invalid/v1/systemone",
        model: "jev-1.14.0",
        apiKeyEnv: "UNSET_FIXTURE_KEY",
        images: true,
        logging: { enabled: true, databasePath: fixture.databasePath }
      })
    );
    const source = path.join(fixture.directory, "request.json");
    fs.writeFileSync(source, imageRequest(base64));
    const child = spawnSync(
      "node",
      [entry, "--config", config, "json", "--file", source, "--dry-run"],
      {
        cwd: fixture.directory,
        env: { PATH: process.env.PATH, HOME: fixture.directory },
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024
      }
    );
    assert.equal(child.status, 0, child.stderr);
    const output = decodeSuccess(child.stdout);
    assert.equal(output.meta.attempts, 0);
    const assets = object(object(output.result.request).assets);
    const [reference] = Object.keys(assets);
    assert.equal(object(assets[reference]).data_base64, base64);
    assert.equal(object(assets[reference]).format, "png");
    assert.equal(fs.existsSync(fixture.databasePath), false);
  } finally {
    fixture.cleanup();
  }
});

test("inline Base64 rejects malformed alphabets and padding while canonical variants remain valid", async () => {
  for (const length of [0, 1, 2]) {
    const base64 = pngFixture(280, 280, length).bytes.toString("base64");
    const valid = await runCli(
      ["json", "--json", imageRequest(base64), "--dry-run"],
      imageRuntime()
    );
    assert.equal(valid.exitCode, 0, valid.stderr);
    const invalid = [
      "",
      base64 + "=",
      base64 + "\n",
      base64.slice(0, -1),
      "=" + base64.slice(1),
      base64.slice(0, 8) + "=" + base64.slice(9),
      "_" + base64.slice(1)
    ];
    if (base64.endsWith("=")) {
      const at = base64.indexOf("=") - 1;
      const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const changed = alphabet[alphabet.indexOf(base64[at]) | 1];
      invalid.push(base64.slice(0, at) + changed + base64.slice(at + 1));
    }
    for (const candidate of invalid) {
      const outcome = await runCli(
        ["json", "--json", imageRequest(candidate), "--dry-run"],
        imageRuntime()
      );
      assert.equal(outcome.exitCode, 2);
      assert.equal(decodeFailure(outcome.stdout).meta.attempts, 0);
      assert.equal(decodeFailure(outcome.stdout).error.kind, "input");
    }
  }
});

const rubric =
  '{"label":"low","details":["none",{"10":{"a":100,"b":"9007199254740993"},"2":null,"__proto__":{"yes":true,"no":false}}]}';
const reordered =
  '{"details":["none",{"__proto__":{"no":false,"yes":true},"2":null,"10":{"b":"9007199254740993","a":100}}],"label":"low"}';
function scoreRequest(): string {
  return `{"state":"evidence","questions":{"score":{"type":"score","instructions":"rate","criteria":[${rubric},["high",{"a":1,"b":2}]]}}}`;
}
function scoreResponse(level: string, high = '["high",{"b":2,"a":1}]'): string {
  return `{"model":"typesafe/jev-1.14-20261014","answers":{"score":{"type":"score","score":0.3,"confidence":0.1,"probabilities":{"0":0.7,"1":0.3},"legend":{"0":${level},"1":${high}}}}}`;
}

test("structured Jev legends ignore object member order but retain raw and request order", async () => {
  let sent = 0;
  let body: string | undefined;
  const response = scoreResponse(reordered);
  const outcome = await runCli(
    ["json", "--json", scoreRequest()],
    runtime({
      fetch: async (_url, init) => {
        sent++;
        assert.ok(typeof init.body === "string");
        body = init.body;
        return new Response(response);
      }
    })
  );
  assert.equal(outcome.exitCode, 0, outcome.stderr);
  assert.equal(sent, 1);
  assert.ok(body?.includes(`"criteria":[${rubric},["high",{"a":1,"b":2}]]`));
  const envelope = parseJson(outcome.stdout);
  assert.ok(record(envelope));
  assert.equal(stringifyJson(envelope.result), response);
  const normalized = envelope.normalized;
  assert.ok(record(normalized));
  const answers = normalized.answers;
  assert.ok(record(answers));
  const score = answers.score;
  assert.ok(record(score));
  assert.equal(
    stringifyJson(score.legend),
    `{"0":${reordered},"1":["high",{"b":2,"a":1}]}`
  );
  assert.equal(
    stringifyJson(score.requestRubric),
    `[${rubric},["high",{"a":1,"b":2}]]`
  );
});

test("structured Jev legends reject reordered arrays changed own keys types and values", async () => {
  const invalid = [
    scoreResponse(reordered.replace('"a":100', '"a":101')),
    scoreResponse(reordered.replace('"2":null', '"2":false')),
    scoreResponse(reordered.replace('"no":false,', "")),
    scoreResponse(
      reordered.replace('"label":"low"', '"label":"low","extra":null')
    ),
    scoreResponse(
      reordered.replace('"9007199254740993"', '"9007199254740992"')
    ),
    scoreResponse(reordered, '[{"b":2,"a":1},"high"]'),
    scoreResponse(reordered, '["high",{"b":2,"a":1},null]')
  ];
  for (const response of invalid) {
    let sent = 0;
    const outcome = await runCli(
      ["json", "--json", scoreRequest()],
      runtime({
        fetch: async () => {
          sent++;
          return new Response(response);
        }
      })
    );
    assert.equal(outcome.exitCode, 3);
    assert.equal(sent, 1);
    const output = decodeFailure(outcome.stdout);
    assert.equal(output.error.kind, "invalid_response");
    assert.equal(output.meta.attempts, 1);
    assert.equal(output.result, null);
  }
});
