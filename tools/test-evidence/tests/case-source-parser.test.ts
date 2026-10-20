import assert from "node:assert/strict";
import test from "node:test";
import { parseCaseSource } from "../src/case-source-parser.ts";

test("Case section items validate text and token grammars", () => {
  const text =
    "### Case GRAMMAR-SECTION-ITEM-001: item grammar\n\nTests:\n- `test:valid`\n\nTags:\n- `valid-tag`\n\nContract:\n- valid contract\n\nProves:\n- valid observation\n";
  const valid = parseCaseSource({ path: "cases/items.md", text });
  assert.deepEqual(valid.diagnostics, []);
  assert.deepEqual(valid.value?.case.contract, ["valid contract"]);
  const inputs = [
    {
      from: "- `test:valid`",
      to: "- `test:has space`",
      code: "case.test-item-invalid"
    },
    {
      from: "- `valid-tag`",
      to: "- `Invalid-Tag`",
      code: "case.tag-item-invalid"
    },
    {
      from: "- valid contract",
      to: "-  untrimmed",
      code: "case.text-item-invalid"
    },
    { from: "- valid observation", to: "- ", code: "case.text-item-invalid" }
  ];
  for (const input of inputs) {
    const result = parseCaseSource({
      path: "cases/items.md",
      text: text.replace(input.from, input.to)
    });
    assert.equal(result.value, null);
    assert.ok(result.diagnostics.some(({ code }) => code === input.code));
  }
});

test("Case duplicate Tests identify each repeated relation", () => {
  const result = parseCaseSource({
    path: "cases/repeated.md",
    text: "### Case GRAMMAR-REPEATED-TEST-001: repeated tests\n\nTests:\n- `test:repeat`\n- `test:repeat`\n- `test:repeat`\n\nContract:\n- relations are unique\n\nProves:\n- each repetition is diagnosed\n"
  });
  assert.equal(result.value, null);
  const duplicates = result.diagnostics.filter(
    ({ code }) => code === "case.tests-duplicate"
  );
  assert.equal(duplicates.length, 2);
  for (const diagnostic of duplicates) {
    assert.equal(diagnostic.testId, "test:repeat");
    assert.equal(diagnostic.caseId, "GRAMMAR-REPEATED-TEST-001");
    assert.match(
      diagnostic.message,
      /GRAMMAR-REPEATED-TEST-001 -> test:repeat/u
    );
  }
});

test("Case duplicate Tags produce one collection diagnostic", () => {
  const result = parseCaseSource({
    path: "cases/order.md",
    text: "### Case GRAMMAR-TOKEN-ORDER-001: token order\n\nTests:\n- `test:a`\n\nTags:\n- `a`\n- `a`\n- `a`\n\nContract:\n- tags are unique\n\nProves:\n- collection duplication is diagnosed\n"
  });
  assert.equal(result.value, null);
  assert.equal(
    result.diagnostics.filter(({ code }) => code === "case.tags-duplicate")
      .length,
    1
  );
});

test("Case Tests and Tags enforce ascending lexical order", () => {
  const result = parseCaseSource({
    path: "cases/order.md",
    text: "### Case GRAMMAR-TOKEN-ORDER-001: token order\n\nTests:\n- `test:z`\n- `test:a`\n\nTags:\n- `z`\n- `a`\n\nContract:\n- token lists are ordered\n\nProves:\n- each unsorted list is diagnosed\n"
  });
  assert.equal(result.value, null);
  assert.deepEqual(
    result.diagnostics.map(({ code }) => code),
    ["case.tests-unsorted", "case.tags-unsorted"]
  );
});
