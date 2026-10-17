import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../src/cli.ts";
import { imageDimensions } from "../src/image-dimensions.ts";
import {
  configured,
  prepared,
  input,
  image,
  png,
  openai,
  typesafe,
  router
} from "./adapter-fixture.ts";
import { array } from "./statistics-fixture.ts";
import { object, decodeFailure } from "./output.ts";
import { logFixture } from "./log-fixture.ts";
import fs from "node:fs";

test("image dimensions retain distinct width and height from PNG and JPEG frame metadata", () => {
  const pngBytes = Buffer.from(png(301, 280).split(",")[1], "base64");
  // A JPEG SOF metadata fixture exercises the header reader, not full codec validity.
  const jpegBytes = Buffer.from([
    0xff,
    0xd8, // SOI
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00, // application segment
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    0x01,
    0x18,
    0x01,
    0x2d,
    0x01,
    0x01,
    0x11,
    0x00, // one-component SOF: height=280, width=301
    0xff,
    0xd9 // EOI
  ]);
  for (const [bytes, format] of [
    [pngBytes, "png"],
    [jpegBytes, "jpeg"]
  ] as const)
    assert.deepEqual(imageDimensions(bytes, format), {
      width: 301,
      height: 280
    });
});

test("image permissions scan every scope and malformed inline nodes refuse before credentials storage assets or HTTP", async () => {
  const fixture = logFixture();
  try {
    for (const state of [
      image(),
      { nested: [image()] },
      { type: "input_image", image_url: "https://private.invalid" }
    ]) {
      for (const config of [openai, typesafe, router, {}]) {
        const outcome = await runCli(
          ["json", "--json", input(state)],
          configured(
            {
              ...config,
              logging: { enabled: true, databasePath: fixture.databasePath }
            },
            { env: {}, fetch: async () => assert.fail("images disabled") }
          )
        );
        assert.equal(outcome.exitCode, 2);
        assert.equal(decodeFailure(outcome.stdout).meta.attempts, 0);
        assert.equal(fs.existsSync(fixture.databasePath), false);
      }
    }
    const scopes = [
      { type: "noul", instructions: { image: image() } },
      { type: "noul", instructions: "n", criteria: { false: [image()] } },
      {
        type: "choice",
        instructions: "pick",
        criteria: { a: image(), b: "B" }
      },
      { type: "score", instructions: "rate", criteria: ["low", image()] }
    ];
    for (const question of scopes) {
      const outcome = await runCli(
        ["json", "--json", input("s", { answer: question }), "--dry-run"],
        configured(router, { env: {} })
      );
      assert.equal(outcome.exitCode, 2);
      assert.equal(decodeFailure(outcome.stdout).meta.attempts, 0);
    }
    for (const url of [
      "https://private.invalid/image.png",
      "/private/image.png",
      "data:image/png;base64,AA==",
      "data:image/jpeg;base64, /9j/",
      "data:image/gif;base64,AAAA"
    ]) {
      const outcome = await runCli(
        ["json", "--json", input(image(url)), "--dry-run"],
        configured({ ...typesafe, images: true }, { env: {} })
      );
      assert.equal(outcome.exitCode, 2, outcome.stdout);
      assert.equal(outcome.stdout.includes(url), false);
    }
  } finally {
    fixture.cleanup();
  }
});

test("native TypeSafe assets retain scoped image associations and OpenRouter alpha preserves inline nodes with model specific long context gates", async () => {
  const source = input(
    { items: [image(), "ordinary-path.png"] },
    {
      score: {
        type: "score",
        instructions: [image(), "rate"],
        criteria: [image(), "high"]
      },
      box: { type: "box", instructions: "locate target" }
    }
  );
  const { prepared: p } = await prepared(source, {
    ...typesafe,
    images: true,
    longContext: true
  });
  assert.deepEqual(p.headers, {
    "TypeSafe-Danger-Zone-Images": "true",
    "TypeSafe-Danger-Zone-Long-Context": "true"
  });
  const assets = object(p.wire.assets);
  assert.equal(Object.keys(assets).length, 3);
  const manifest = array(p.manifest.images).map(object);
  for (const entry of manifest) {
    assert.equal(typeof entry.reference, "string");
    assert.equal(Object.hasOwn(assets, String(entry.reference)), true);
    assert.equal(String(entry.reference).includes("/"), false);
  }
  assert.equal(object(object(p.wire.questions).box).type, "box");
  assert.equal(p.body.includes("data:image"), false);
  assert.ok(p.carrierJson?.includes("data:image"));
  const pass = await prepared(source, {
    ...router,
    images: true,
    longContext: true
  });
  assert.deepEqual(pass.prepared.headers, {});
  assert.equal(pass.prepared.carrierJson, null);
  assert.ok(pass.prepared.body.includes("data:image/png;base64,"));
  for (const config of [
    { ...router, images: true },
    { ...typesafe, images: true, model: "jev-1.13" },
    {
      ...router,
      images: true,
      longContext: true,
      model: "openai/gpt-6-luna-decisions"
    }
  ]) {
    const outcome = await runCli(
      ["json", "--json", source, "--dry-run"],
      configured(config, { env: {} })
    );
    assert.equal(outcome.exitCode, 2, outcome.stdout);
  }
  const long = input("x".repeat(35000));
  for (const config of [
    router,
    { ...router, longContext: true },
    typesafe,
    { ...typesafe, longContext: true },
    openai
  ]) {
    const result = await runCli(
      ["json", "--json", long, "--dry-run"],
      configured(config, { env: {} })
    );
    assert.equal(result.exitCode, config === router ? 2 : 0, result.stdout);
  }
});

test("OpenAI images become path labelled shared user input with occurrence limits and no silent local image promotion or Box fallback", async () => {
  const source = input({ photos: [image(), image()], literal: "unchanged" });
  const { prepared: p } = await prepared(source, { ...openai, images: true });
  const content = array(object(array(p.wire.input)[0]).content).map(object);
  assert.deepEqual(
    content.map((part) => part.type),
    ["input_text", "input_text", "input_image", "input_text", "input_image"]
  );
  assert.equal(content[2].image_url, image().image_url.url);
  assert.equal(content[4].image_url, image().image_url.url);
  assert.ok(
    String(content[1].text).includes('$[\\"state\\"][\\"photos\\"][0]')
  );
  const accepted = await prepared(
    input(Array.from({ length: 128 }, () => image())),
    { ...openai, images: true }
  );
  assert.equal(array(accepted.prepared.manifest.images).length, 128);
  const sources = [
    input(Array.from({ length: 129 }, () => image())),
    input("s", { a: { type: "noul", instructions: image() } }),
    input(image(), { a: { type: "box", instructions: "locate" } }),
    input("s", {
      a: { type: "choice", instructions: "pick", criteria: { only: "one" } }
    }),
    input(
      "s",
      Object.fromEntries(
        Array.from({ length: 201 }, (_, i) => [
          i,
          { type: "noul", instructions: "yes?" }
        ])
      )
    ),
    input("s", { a: { type: "noul", instructions: "x".repeat(1048576) } })
  ];
  for (const source of sources) {
    const outcome = await runCli(
      ["json", "--json", source, "--dry-run"],
      configured(
        { ...openai, images: true },
        { env: {}, fetch: async () => assert.fail("capability rejection") }
      )
    );
    assert.equal(outcome.exitCode, 2, outcome.stdout);
    assert.equal(decodeFailure(outcome.stdout).meta.attempts, 0);
  }
});
