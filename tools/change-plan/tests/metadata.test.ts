import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ChangePlanMetadataError,
  parseChangePlanMetadata,
  readChangePlanMetadata,
  writeChangePlanMetadata
} from "../src/metadata.ts";
import { validBaseCommit, withTempRoot } from "./support.ts";

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

test("metadata parser accepts only canonical draft and plan values", () => {
  const cases: ReadonlyArray<{ accepted: boolean; value: unknown }> = [
    {
      accepted: true,
      value: { stage: "draft" }
    },
    {
      accepted: true,
      value: {
        baseCommit: validBaseCommit,
        stage: "plan"
      }
    },
    {
      accepted: false,
      value: { extra: true, stage: "draft" }
    },
    {
      accepted: false,
      value: {
        baseCommit: ` ${validBaseCommit}`,
        stage: "plan"
      }
    },
    {
      accepted: false,
      value: { baseCommit: null, stage: "plan" }
    },
    {
      accepted: false,
      value: { baseCommit: validBaseCommit, stage: "implementation" }
    },
    {
      accepted: false,
      value: {
        baseCommit: validBaseCommit,
        shelf: {
          atCommit: validBaseCommit,
          reason: "等待上游",
          source: "explicit"
        },
        stage: "shelved"
      }
    }
  ];

  for (const metadataCase of cases) {
    assert.equal(runtimeAccepts(metadataCase.value), metadataCase.accepted);
  }
});

test("metadata writer emits canonical draft and plan JSON", () =>
  withTempRoot("metadata-writer", async (tempRoot) => {
    const draftDirectory = path.join(tempRoot, "draft");
    const planDirectory = path.join(tempRoot, "plan");
    await Promise.all([fs.mkdir(draftDirectory), fs.mkdir(planDirectory)]);

    await writeChangePlanMetadata(draftDirectory, { stage: "draft" });
    await writeChangePlanMetadata(planDirectory, {
      baseCommit: validBaseCommit,
      stage: "plan"
    });

    assert.deepEqual(await readChangePlanMetadata(draftDirectory), {
      stage: "draft"
    });
    assert.deepEqual(await readChangePlanMetadata(planDirectory), {
      baseCommit: validBaseCommit,
      stage: "plan"
    });
    assert.equal(
      await fs.readFile(path.join(planDirectory, ".change-plan.json"), "utf8"),
      `${JSON.stringify(
        {
          baseCommit: validBaseCommit,
          stage: "plan"
        },
        null,
        2
      )}\n`
    );

    const failedDirectory = path.join(tempRoot, "rename-failure");
    const failedMetadataPath = path.join(failedDirectory, ".change-plan.json");
    const previousContents = `${JSON.stringify({ stage: "draft" }, null, 2)}\n`;
    await fs.mkdir(failedDirectory);
    await fs.writeFile(failedMetadataPath, previousContents, "utf8");

    const originalRename = fs.rename.bind(fs);
    let renameAttempted = false;
    Object.defineProperty(fs, "rename", {
      configurable: true,
      value: async (...arguments_: Parameters<typeof fs.rename>) => {
        const [oldPath, newPath] = arguments_;
        if (String(newPath) === failedMetadataPath) {
          renameAttempted = true;
          throw new Error("forced metadata rename failure");
        }
        return await originalRename(oldPath, newPath);
      },
      writable: true
    });
    try {
      await assertMetadataError(
        () =>
          writeChangePlanMetadata(failedDirectory, {
            baseCommit: validBaseCommit,
            stage: "plan"
          }),
        "io"
      );
    } finally {
      Object.defineProperty(fs, "rename", {
        configurable: true,
        value: originalRename,
        writable: true
      });
    }
    assert.equal(renameAttempted, true);
    assert.equal(
      await fs.readFile(failedMetadataPath, "utf8"),
      previousContents
    );
    assert.deepEqual(await fs.readdir(failedDirectory), [".change-plan.json"]);
  }));

test("metadata reader maps file and parse boundaries to stable error codes", () =>
  withTempRoot("metadata-errors", async (tempRoot) => {
    const missingDirectory = path.join(tempRoot, "missing");
    await fs.mkdir(missingDirectory);
    await assertMetadataError(
      () => readChangePlanMetadata(missingDirectory),
      "missing"
    );

    const nonFileDirectory = path.join(tempRoot, "non-file");
    await fs.mkdir(path.join(nonFileDirectory, ".change-plan.json"), {
      recursive: true
    });
    await assertMetadataError(
      () => readChangePlanMetadata(nonFileDirectory),
      "invalid-path"
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
      "invalid"
    );

    for (const [name, metadata] of [
      ["unknown-stage", { stage: "unknown" }],
      [
        "implementation-stage",
        { baseCommit: validBaseCommit, stage: "implementation" }
      ],
      [
        "shelved-stage",
        {
          baseCommit: validBaseCommit,
          shelf: {
            atCommit: validBaseCommit,
            reason: "等待上游输入",
            source: "explicit"
          },
          stage: "shelved"
        }
      ],
      ["null-base-plan", { baseCommit: null, stage: "plan" }]
    ] as const) {
      const invalidDirectory = path.join(tempRoot, name);
      await fs.mkdir(invalidDirectory);
      await fs.writeFile(
        path.join(invalidDirectory, ".change-plan.json"),
        JSON.stringify(metadata),
        "utf8"
      );
      await assertMetadataError(
        () => readChangePlanMetadata(invalidDirectory),
        "invalid"
      );
    }
  }));

test("metadata reader and writer reject symbolic-link metadata", () =>
  withTempRoot("metadata-symlink", async (tempRoot) => {
    const changeDirectory = path.join(tempRoot, "linked-metadata");
    const targetPath = path.join(tempRoot, "metadata-target.json");
    const original = `${JSON.stringify({ stage: "draft" })}\n`;
    await fs.mkdir(changeDirectory);
    await fs.writeFile(targetPath, original, "utf8");
    await fs.symlink(
      targetPath,
      path.join(changeDirectory, ".change-plan.json"),
      "file"
    );

    await assertMetadataError(
      () => readChangePlanMetadata(changeDirectory),
      "invalid-path"
    );
    await assertMetadataError(
      () => writeChangePlanMetadata(changeDirectory, { stage: "draft" }),
      "invalid-path"
    );
    assert.equal(await fs.readFile(targetPath, "utf8"), original);

    const replacedDirectory = path.join(tempRoot, "replaced-link");
    const replacedMetadataPath = path.join(
      replacedDirectory,
      ".change-plan.json"
    );
    const displacedMetadataPath = path.join(
      replacedDirectory,
      ".change-plan.original.json"
    );
    const externalPath = path.join(tempRoot, "external-target.json");
    const externalContents = "external target must remain unchanged\n";
    await fs.mkdir(replacedDirectory);
    await fs.writeFile(replacedMetadataPath, original, "utf8");
    await fs.writeFile(externalPath, externalContents, "utf8");

    const originalRename = fs.rename.bind(fs);
    let linkInserted = false;
    Object.defineProperty(fs, "rename", {
      configurable: true,
      value: async (...arguments_: Parameters<typeof fs.rename>) => {
        const [oldPath, newPath] = arguments_;
        if (!linkInserted && String(newPath) === replacedMetadataPath) {
          linkInserted = true;
          await originalRename(replacedMetadataPath, displacedMetadataPath);
          await fs.symlink(externalPath, replacedMetadataPath, "file");
        }
        return await originalRename(oldPath, newPath);
      },
      writable: true
    });
    try {
      await writeChangePlanMetadata(replacedDirectory, {
        baseCommit: validBaseCommit,
        stage: "plan"
      });
    } finally {
      Object.defineProperty(fs, "rename", {
        configurable: true,
        value: originalRename,
        writable: true
      });
    }

    assert.equal(linkInserted, true);
    assert.equal(await fs.readFile(externalPath, "utf8"), externalContents);
    const finalMetadataStat = await fs.lstat(replacedMetadataPath);
    assert.equal(finalMetadataStat.isSymbolicLink(), false);
    assert.equal(finalMetadataStat.isFile(), true);
    assert.deepEqual(await readChangePlanMetadata(replacedDirectory), {
      baseCommit: validBaseCommit,
      stage: "plan"
    });
  }));
