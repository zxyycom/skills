import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import {
  parseLedgerCaseSource,
  readLedgerCaseSource
} from "../src/ledger/case-source.ts";
import {
  parseTestEntityIndex
} from "../src/ledger/entity-index.ts";
import {
  readTestEvidenceLedgerSource
} from "../src/ledger/ledger-source.ts";
import {
  queryTestEntitiesOptionsSchema,
  queryTestEvidenceCasesOptionsSchema,
  showTestEvidenceCaseOptionsSchema,
  syncTestEvidenceLedgerIndexOptionsSchema,
  testEntityIndexSchema,
  testEvidenceLedgerStateIndexSchema,
  validateTestEvidenceLedgerOptionsSchema
} from "../src/ledger/index.ts";
import { syncTestEvidenceLedgerIndex } from "../src/ledger/state-index.ts";
import {
  caseMarkdown,
  casesPath,
  entityIndexPath,
  entityIndexText,
  ledgerIndexPath,
  manyToManyCases,
  manyToManyEntities,
  readJsonFile,
  withLedgerWorkspace,
  writeWorkspaceFile
} from "./ledger-fixture.ts";

test("entity indexes parse canonical empty and populated sources with stable fingerprints", () => {
  const populated = parseTestEntityIndex({
    path: "docs/test-evidence/test-entity-index.json",
    text: entityIndexText(manyToManyEntities, "revision-v1")
  });
  assert.notEqual(populated.parsed, null);

  const reformatted = parseTestEntityIndex({
    path: "docs/test-evidence/test-entity-index.json",
    text: JSON.stringify({
      entities: manyToManyEntities.map((entity) => ({
        locators: entity.locators,
        name: entity.name,
        id: entity.id
      })),
      sourceRevision: "revision-v1",
      schemaVersion: 1
    })
  });
  assert.notEqual(reformatted.parsed, null);
  assert.equal(
    populated.parsed?.identity.fingerprint,
    reformatted.parsed?.identity.fingerprint
  );

  const changed = parseTestEntityIndex({
    path: "docs/test-evidence/test-entity-index.json",
    text: entityIndexText(manyToManyEntities, "revision-v2")
  });
  assert.notEqual(changed.parsed?.identity.fingerprint, populated.parsed?.identity.fingerprint);

  const reusedRevision = parseTestEntityIndex({
    path: "docs/test-evidence/test-entity-index.json",
    text: entityIndexText([
      {
        ...manyToManyEntities[0]!,
        name: "Changed alpha behavior",
        locators: ["tests/alpha-renamed.test.ts > changed alpha behavior"]
      },
      ...manyToManyEntities.slice(1)
    ], "revision-v1")
  });
  assert.notEqual(
    reusedRevision.parsed?.identity.fingerprint,
    populated.parsed?.identity.fingerprint
  );

  const empty = parseTestEntityIndex({
    path: "docs/test-evidence/test-entity-index.json",
    text: entityIndexText([], "empty-v1")
  });
  assert.deepEqual(empty.diagnostics, []);
  assert.deepEqual(empty.parsed?.value.entities, []);
});

test("entity indexes reject invalid schemas ordering identities and locators", async () => {
  const invalidValues: unknown[] = [
    {
      schemaVersion: 2,
      sourceRevision: "revision-v1",
      entities: []
    },
    {
      schemaVersion: 1,
      sourceRevision: "revision-v1",
      entities: [],
      unknown: true
    },
    {
      schemaVersion: 1,
      sourceRevision: "revision-v1",
      entities: [manyToManyEntities[1], manyToManyEntities[0]]
    },
    {
      schemaVersion: 1,
      sourceRevision: "revision-v1",
      entities: [manyToManyEntities[0], manyToManyEntities[0]]
    },
    {
      schemaVersion: 1,
      sourceRevision: "revision-v1",
      entities: [{
        id: "bad id",
        name: "Bad ID",
        locators: ["tests/bad.test.ts > bad"]
      }]
    },
    {
      schemaVersion: 1,
      sourceRevision: "revision-v1",
      entities: [{
        id: "test.bad",
        name: "Duplicate locators",
        locators: ["same locator", "same locator"]
      }]
    },
    {
      schemaVersion: 1,
      sourceRevision: "revision-v1",
      entities: [{
        id: "test.bad",
        name: "Bad locators",
        locators: ["z locator", "a locator"]
      }]
    }
  ];
  for (const value of invalidValues) {
    const result = parseTestEntityIndex({
      path: "docs/test-evidence/test-entity-index.json",
      text: JSON.stringify(value)
    });
    assert.equal(result.parsed, null);
    assert.ok(result.diagnostics.some(
      (diagnostic) => diagnostic.category === "entity-index"
    ));
  }
  assert.equal(v.safeParse(testEntityIndexSchema, {
    schemaVersion: 1,
    sourceRevision: "revision-v1",
    entities: [],
    extra: true
  }).success, false);

  await withLedgerWorkspace(async (workspaceRoot) => {
    await fs.writeFile(
      entityIndexPath(workspaceRoot),
      invalidUtf8Text(
        '{"schemaVersion":1,"sourceRevision":"revision-',
        '","entities":[]}\n'
      )
    );
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.equal(loaded.source, null);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "entity-index.encoding-invalid"
    ));
    const synchronized = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synchronized.status, "error");
    assert.equal(await fileExists(ledgerIndexPath(workspaceRoot)), false);
  }, "empty");
});

test("ledger roots enforce the fixed flat regular-file layout", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/unsupported.json",
      "{}\n"
    );
    let loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.root-member-unsupported"
    ));

    await fs.rm(path.join(
      workspaceRoot,
      "docs",
      "test-evidence",
      "unsupported.json"
    ));
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/nested/case.md",
      caseMarkdown(manyToManyCases[0]!)
    );
    loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.member-unsupported"
    ));

    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/readme.txt",
      "not a Case\n"
    );
    await fs.symlink(
      entityIndexPath(workspaceRoot),
      path.join(casesPath(workspaceRoot), "linked.md")
    );
    loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.member-unsupported"
        && diagnostic.path?.endsWith("readme.txt")
    ));
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.path-invalid"
        && diagnostic.path?.endsWith("linked.md")
    ));
  }, "empty");
});

test("ledger source files reject filesystem identity collisions", async () => {
  await withLedgerWorkspace(async (workspaceRoot) => {
    const synchronized = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synchronized.status, "ok");
    await fs.rm(ledgerIndexPath(workspaceRoot));
    await fs.link(
      entityIndexPath(workspaceRoot),
      ledgerIndexPath(workspaceRoot)
    );
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "index.identity-conflict"
    ));
  });

  await withLedgerWorkspace(async (workspaceRoot) => {
    await syncTestEvidenceLedgerIndex({ mode: "write", workspaceRoot });
    await fs.rm(ledgerIndexPath(workspaceRoot));
    await fs.link(
      path.join(casesPath(workspaceRoot), "alpha-beta.md"),
      ledgerIndexPath(workspaceRoot)
    );
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "index.identity-conflict"
    ));
  });

  await withLedgerWorkspace(async (workspaceRoot) => {
    const alphaBeta = path.join(casesPath(workspaceRoot), "alpha-beta.md");
    const alphaGamma = path.join(casesPath(workspaceRoot), "alpha-gamma.md");
    await fs.rm(alphaGamma);
    await fs.link(alphaBeta, alphaGamma);
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.identity-conflict"
    ));
  });

  await withLedgerWorkspace(async (workspaceRoot) => {
    const alphaBeta = path.join(casesPath(workspaceRoot), "alpha-beta.md");
    await fs.rm(alphaBeta);
    await fs.link(entityIndexPath(workspaceRoot), alphaBeta);
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "entity-index.identity-conflict"
    ));
  });
});

test("case sources parse canonical multi-test cases with optional tags", async () => {
  const tagged = parseLedgerCaseSource({
    path: manyToManyCases[0]!.sourcePath,
    text: caseMarkdown(manyToManyCases[0]!)
  });
  assert.deepEqual(tagged.value?.case.testIds, ["test.alpha", "test.beta"]);
  assert.deepEqual(tagged.value?.case.tags, ["shared"]);

  const multiTaggedCase = {
    ...manyToManyCases[0]!,
    id: "LEDGER-MULTI-TAG-001",
    sourcePath: "cases/multi-tag.md",
    tags: ["alpha", "shared"]
  };
  const multiTagged = parseLedgerCaseSource({
    path: multiTaggedCase.sourcePath,
    text: caseMarkdown(multiTaggedCase)
  });
  assert.deepEqual(multiTagged.value?.case.tags, ["alpha", "shared"]);

  const untaggedCase = {
    ...manyToManyCases[0]!,
    id: "LEDGER-UNTAGGED-CASE-001",
    sourcePath: "cases/untagged.md",
    tags: []
  };
  const untagged = parseLedgerCaseSource({
    path: untaggedCase.sourcePath,
    text: caseMarkdown(untaggedCase)
  });
  assert.deepEqual(untagged.value?.case.tags, []);

  await withLedgerWorkspace(async (workspaceRoot) => {
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.notEqual(loaded.source, null);
    assert.equal(await fileExists(casesPath(workspaceRoot)), false);

    await fs.mkdir(casesPath(workspaceRoot));
    const explicitEmpty = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.deepEqual(explicitEmpty.diagnostics, []);
    assert.notEqual(explicitEmpty.source, null);
  }, "empty");
});

test("case sources reject invalid headings sections tests tags and paths", async () => {
  const baseCase = manyToManyCases[0]!;
  const base = caseMarkdown(baseCase);
  const twoTags = caseMarkdown({
    ...baseCase,
    tags: ["alpha", "shared"]
  });
  const variants = [
    { path: baseCase.sourcePath, text: `\n${base}` },
    { path: baseCase.sourcePath, text: base.replace("Tests:", "Unknown:") },
    { path: baseCase.sourcePath, text: base.replace(
      "- `test.alpha`\n- `test.beta`",
      "- `test.beta`\n- `test.alpha`"
    ) },
    { path: baseCase.sourcePath, text: base.replace(
      "- `test.alpha`\n- `test.beta`",
      "- `test.alpha`\n- `test.alpha`"
    ) },
    { path: baseCase.sourcePath, text: base.replace("`shared`", "`Bad Tag`") },
    { path: baseCase.sourcePath, text: base.replace(
      "- `shared`",
      "- `shared`\n- `shared`"
    ) },
    { path: baseCase.sourcePath, text: base.replace("- `shared`\n", "") },
    { path: baseCase.sourcePath, text: twoTags.replace(
      "- `alpha`\n- `shared`",
      "- `shared`\n- `alpha`"
    ) },
    { path: baseCase.sourcePath, text: base.replace("Contract:", "Unknown:") },
    { path: baseCase.sourcePath, text: base.replace(
      "- Alpha and beta jointly support one semantic conclusion.\n",
      ""
    ) },
    { path: baseCase.sourcePath, text: base.replace("Proves:", "Unknown:") },
    { path: baseCase.sourcePath, text: base.replace(
      "- The shared alpha-beta result is observable.\n",
      ""
    ) },
    { path: baseCase.sourcePath, text: base.replace(
      "Contract:\n- Alpha and beta jointly support one semantic conclusion.\n\nProves:\n- The shared alpha-beta result is observable.",
      "Proves:\n- The shared alpha-beta result is observable.\n\nContract:\n- Alpha and beta jointly support one semantic conclusion."
    ) },
    { path: baseCase.sourcePath, text: `${base}### Case LEDGER-EXTRA-CASE-001: Extra Case\n` },
    { path: baseCase.sourcePath, text: `${base}Extra body\n` },
    { path: "cases/Bad-Name.md", text: base }
  ];
  for (const variant of variants) {
    const parsed = parseLedgerCaseSource(variant);
    assert.equal(parsed.value, null);
    assert.ok(parsed.diagnostics.length > 0);
  }

  await withLedgerWorkspace(async (workspaceRoot) => {
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/duplicate-one.md",
      base
    );
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/duplicate-two.md",
      base
    );
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.id-duplicate"
        && diagnostic.caseId === baseCase.id
    ));
  }, "empty");

  await withLedgerWorkspace(async (workspaceRoot) => {
    const sourceText = caseMarkdown(baseCase);
    const invalidOffset = sourceText.indexOf("Alpha");
    assert.notEqual(invalidOffset, -1);
    await fs.writeFile(
      path.join(casesPath(workspaceRoot), "alpha-beta.md"),
      invalidUtf8Text(
        sourceText.slice(0, invalidOffset),
        sourceText.slice(invalidOffset + 1)
      )
    );
    const loaded = await readTestEvidenceLedgerSource(workspaceRoot);
    assert.equal(loaded.source, null);
    assert.ok(loaded.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.encoding-invalid"
    ));
    const direct = await readLedgerCaseSource(
      workspaceRoot,
      "cases/alpha-beta.md"
    );
    assert.equal(direct.value, null);
    assert.ok(direct.diagnostics.some(
      (diagnostic) => diagnostic.code === "case.encoding-invalid"
    ));
    const synchronized = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synchronized.status, "error");
    assert.equal(await fileExists(ledgerIndexPath(workspaceRoot)), false);
  });
});

test("ledger schemas reject unknown fields and incompatible versions", async () => {
  const invalidOptions: Array<[unknown, Parameters<typeof v.safeParse>[0]]> = [
    [{ workspaceRoot: "/tmp/example", unknown: true }, validateTestEvidenceLedgerOptionsSchema],
    [{ workspaceRoot: "/tmp/example", mode: "check", unknown: true }, syncTestEvidenceLedgerIndexOptionsSchema],
    [{ workspaceRoot: "/tmp/example", unknown: true }, queryTestEvidenceCasesOptionsSchema],
    [{ workspaceRoot: "/tmp/example", caseId: "LEDGER-VALID-CASE-001", unknown: true }, showTestEvidenceCaseOptionsSchema],
    [{ workspaceRoot: "/tmp/example", unknown: true }, queryTestEntitiesOptionsSchema]
  ];
  for (const [input, schema] of invalidOptions) {
    assert.equal(v.safeParse(schema, input).success, false);
  }

  await withLedgerWorkspace(async (workspaceRoot) => {
    const synchronized = await syncTestEvidenceLedgerIndex({
      mode: "write",
      workspaceRoot
    });
    assert.equal(synchronized.status, "ok");
    const index = await readJsonFile(ledgerIndexPath(workspaceRoot));
    assert.equal(v.safeParse(testEvidenceLedgerStateIndexSchema, index).success, true);
    assert.equal(v.safeParse(testEvidenceLedgerStateIndexSchema, {
      ...(index as Record<string, unknown>),
      definitionVersion: 3
    }).success, false);
  }, "empty");
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function invalidUtf8Text(prefix: string, suffix: string): Buffer {
  return Buffer.concat([
    Buffer.from(prefix, "utf8"),
    Buffer.from([0xc3, 0x28]),
    Buffer.from(suffix, "utf8")
  ]);
}
