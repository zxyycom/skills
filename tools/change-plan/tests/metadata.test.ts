import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  ChangePlanMetadataError,
  parseChangePlanMetadata,
  readChangePlanMetadata,
  writeChangePlanMetadata
} from "../src/metadata.ts";
import {
  generatedMetadataSchemaPath,
  validBaseCommit,
  withTempRoot
} from "./support.ts";

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function runtimeAccepts(value: unknown): boolean {
  try {
    parseChangePlanMetadata(value);
    return true;
  } catch (error) {
    if (error instanceof ChangePlanMetadataError) {
      return false;
    }
    throw error;
  }
}

async function assertMetadataError(
  run: () => Promise<unknown>,
  code: ChangePlanMetadataError["code"]
): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof ChangePlanMetadataError);
    assert.equal(error.code, code);
    return true;
  });
}

test("metadata runtime and generated schema enforce the same strict values", async () => {
  const schema: unknown = JSON.parse(
    await fs.readFile(generatedMetadataSchemaPath, "utf8")
  );
  assert.ok(isObject(schema));
  const validateSchema = new Ajv2020({ allErrors: true }).compile(schema);
  const cases: ReadonlyArray<{ accepted: boolean; value: unknown }> = [
    {
      accepted: true,
      value: { schemaVersion: 1, stage: "draft" }
    },
    {
      accepted: true,
      value: {
        baseCommit: validBaseCommit,
        schemaVersion: 1,
        shelf: {
          atCommit: validBaseCommit,
          reason: "等待上游\n重新确认",
          source: "explicit"
        },
        stage: "shelved"
      }
    },
    {
      accepted: false,
      value: { extra: true, schemaVersion: 1, stage: "draft" }
    },
    {
      accepted: false,
      value: {
        baseCommit: ` ${validBaseCommit}`,
        schemaVersion: 1,
        stage: "implementation"
      }
    },
    {
      accepted: false,
      value: {
        baseCommit: validBaseCommit,
        schemaVersion: 1,
        shelf: {
          atCommit: validBaseCommit,
          reason: " 等待上游 ",
          source: "explicit"
        },
        stage: "shelved"
      }
    },
    {
      accepted: false,
      value: {
        baseCommit: validBaseCommit,
        schemaVersion: 1,
        shelf: {
          atCommit: validBaseCommit,
          changedLines: Number.MAX_SAFE_INTEGER + 1,
          commitCount: 1,
          source: "git-distance-v1"
        },
        stage: "shelved"
      }
    }
  ];

  for (const metadataCase of cases) {
    assert.equal(runtimeAccepts(metadataCase.value), metadataCase.accepted);
    assert.equal(validateSchema(metadataCase.value), metadataCase.accepted);
  }
});

test("metadata reader maps file and parse boundaries to stable error codes", () => (
  withTempRoot("metadata-errors", async (tempRoot) => {
    const missingDirectory = path.join(tempRoot, "missing");
    await fs.mkdir(missingDirectory);
    await assertMetadataError(
      () => readChangePlanMetadata(missingDirectory),
      "metadata-not-found"
    );

    const nonFileDirectory = path.join(tempRoot, "non-file");
    await fs.mkdir(path.join(nonFileDirectory, ".change-plan.json"), {
      recursive: true
    });
    await assertMetadataError(
      () => readChangePlanMetadata(nonFileDirectory),
      "metadata-not-regular-file"
    );

    const invalidJsonDirectory = path.join(tempRoot, "invalid-json");
    await fs.mkdir(invalidJsonDirectory);
    await fs.writeFile(
      path.join(invalidJsonDirectory, ".change-plan.json"),
      "{",
      "utf8"
    );
    await assertMetadataError(
      () => readChangePlanMetadata(invalidJsonDirectory),
      "metadata-invalid-json"
    );

    const invalidSchemaDirectory = path.join(tempRoot, "invalid-schema");
    await fs.mkdir(invalidSchemaDirectory);
    await fs.writeFile(
      path.join(invalidSchemaDirectory, ".change-plan.json"),
      JSON.stringify({ schemaVersion: 1, stage: "unknown" }),
      "utf8"
    );
    await assertMetadataError(
      () => readChangePlanMetadata(invalidSchemaDirectory),
      "metadata-invalid-schema"
    );
  })
));

test("metadata reader and writer reject symbolic-link metadata", () => (
  withTempRoot("metadata-symlink", async (tempRoot) => {
    const changeDirectory = path.join(tempRoot, "linked-metadata");
    const targetPath = path.join(tempRoot, "metadata-target.json");
    const original = `${JSON.stringify({ schemaVersion: 1, stage: "draft" })}\n`;
    await fs.mkdir(changeDirectory);
    await fs.writeFile(targetPath, original, "utf8");
    await fs.symlink(
      targetPath,
      path.join(changeDirectory, ".change-plan.json"),
      "file"
    );

    await assertMetadataError(
      () => readChangePlanMetadata(changeDirectory),
      "metadata-symbolic-link"
    );
    await assertMetadataError(
      () => writeChangePlanMetadata(
        changeDirectory,
        { schemaVersion: 1, stage: "draft" }
      ),
      "metadata-symbolic-link"
    );
    assert.equal(await fs.readFile(targetPath, "utf8"), original);
  })
));
