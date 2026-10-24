import assert from "node:assert/strict";
import {
  access,
  mkdir,
  readFile,
  readdir,
  symlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { parseConfiguredOptions } from "../src/arguments.ts";
import { readLocationConfiguration } from "../src/configuration.ts";
import { VideoFailure } from "../src/failure.ts";
import { resourcesFromEntry } from "../src/resources.ts";
import { resources, workspace } from "./fixtures/public-cli.ts";

test("configuration merges omitted and null fields independently without creating or rewriting paths", async () =>
  workspace(async (directory) => {
    const userConfigPath = path.join(directory, "user.json");
    const projectConfigPath = path.join(directory, "project.json");
    const read = () =>
      readLocationConfiguration({
        userConfigPath,
        projectConfigPath,
        resources
      });
    assert.deepEqual(
      await readLocationConfiguration({ userConfigPath, resources }),
      { appRoot: null, dataRoot: null }
    );
    const user = {
      appRoot: path.join(directory, "user app"),
      dataRoot: path.join(directory, "user data")
    };
    const userBytes = JSON.stringify(user);
    await writeFile(userConfigPath, userBytes);
    for (const project of [
      {},
      { appRoot: null },
      { dataRoot: null },
      { appRoot: null, dataRoot: null }
    ]) {
      const bytes = JSON.stringify(project);
      await writeFile(projectConfigPath, bytes);
      assert.deepEqual(await read(), user);
      assert.equal(await readFile(projectConfigPath, "utf8"), bytes);
    }
    const literal = path.join(
      directory,
      "$VIDEO_HOME",
      "%VIDEO_ROOT%",
      "${VIDEO_DATA}"
    );
    await writeFile(projectConfigPath, JSON.stringify({ dataRoot: literal }));
    assert.deepEqual(await read(), {
      appRoot: user.appRoot,
      dataRoot: literal
    });
    await writeFile(projectConfigPath, JSON.stringify({ appRoot: literal }));
    assert.deepEqual(await read(), {
      appRoot: literal,
      dataRoot: user.dataRoot
    });
    assert.equal(await readFile(userConfigPath, "utf8"), userBytes);
    assert.deepEqual((await readdir(directory)).sort(), [
      "project.json",
      "user.json"
    ]);
  }));

test("configuration validates every read layer even when project and CLI values override it", async () =>
  workspace(async (directory) => {
    const userConfigPath = path.join(directory, "user.json");
    const projectConfigPath = path.join(directory, "project.json");
    await writeFile(
      projectConfigPath,
      JSON.stringify({
        appRoot: path.join(directory, "app"),
        dataRoot: path.join(directory, "data")
      })
    );
    const invalid = [
      "invalid JSON",
      "[]",
      "null",
      '{"unknown":true}',
      '{"appRoot":1}',
      '{"dataRoot":"relative"}',
      '{"appRoot":"https://example.invalid/media"}',
      '{"dataRoot":"\\\\server\\\\share"}',
      ...(process.platform === "win32"
        ? ['{"dataRoot":"/root-relative"}', '{"appRoot":"C:drive-relative"}']
        : [])
    ];
    for (const bytes of invalid) {
      await writeFile(userConfigPath, bytes);
      await assert.rejects(
        parseConfiguredOptions(
          ["read", "--output", directory, "--config", projectConfigPath],
          async (selected) => {
            const configured = await readLocationConfiguration({
              userConfigPath,
              projectConfigPath: selected,
              resources
            });
            return {
              appRoot: configured.appRoot ?? undefined,
              evidenceRoot: configured.dataRoot ?? undefined
            };
          }
        ),
        (error) =>
          error instanceof VideoFailure &&
          error.failure.stage === "arguments" &&
          error.failure.target === userConfigPath,
        bytes
      );
      assert.equal(await readFile(userConfigPath, "utf8"), bytes);
    }
  }));

test("selected project configuration is required and strict while an absent user file is optional", async () =>
  workspace(async (directory) => {
    const userConfigPath = path.join(directory, "absent user.json");
    const projectConfigPath = path.join(directory, "selected.json");
    const read = () =>
      readLocationConfiguration({
        userConfigPath,
        projectConfigPath,
        resources
      });
    await assert.rejects(
      read(),
      (error) =>
        error instanceof VideoFailure &&
        error.failure.stage === "arguments" &&
        error.failure.target === projectConfigPath
    );
    for (const bytes of [
      "not JSON",
      '{"dataRoot":false}',
      '{"appRoot":null,"typo":null}'
    ]) {
      await writeFile(projectConfigPath, bytes);
      await assert.rejects(
        read(),
        (error) =>
          error instanceof VideoFailure &&
          error.failure.stage === "arguments" &&
          error.failure.target === projectConfigPath
      );
    }
    await writeFile(projectConfigPath, "{}");
    assert.deepEqual(await read(), { appRoot: null, dataRoot: null });
    await assert.rejects(access(userConfigPath), { code: "ENOENT" });
    await assert.rejects(
      readLocationConfiguration({
        userConfigPath,
        projectConfigPath: "relative.json",
        resources
      }),
      (error) =>
        error instanceof VideoFailure &&
        error.failure.stage === "arguments" &&
        error.failure.target === "relative.json"
    );
  }));

test("help skips configuration reads while help-shaped option values do not suppress validation", async () => {
  let reads = 0;
  const defaults = async () => {
    reads++;
    throw new Error("configuration reader reached");
  };
  assert.equal(
    await parseConfiguredOptions(
      ["--help", "--config", "relative.json"],
      defaults
    ),
    null
  );
  assert.equal(reads, 0);
  await assert.rejects(
    parseConfiguredOptions(["prepare", "--initial-prompt=--help"], defaults),
    /configuration reader reached/
  );
  assert.equal(reads, 1);
  await assert.rejects(
    parseConfiguredOptions(["prepare", "--initial-prompt", "--help"], defaults),
    /invalid flag syntax/
  );
  assert.equal(reads, 1);
});

test("configuration paths and roots reject physical package aliases before any writes", async () =>
  workspace(async (directory) => {
    const installed = path.join(directory, "installed skill");
    await mkdir(path.join(installed, "scripts"), { recursive: true });
    const local = resourcesFromEntry(
      pathToFileURL(path.join(installed, "scripts/video.ts"))
    );
    const alias = path.join(directory, "package alias");
    await symlink(
      installed,
      alias,
      process.platform === "win32" ? "junction" : "dir"
    );
    const userConfigPath = path.join(directory, "user.json");
    for (const field of ["appRoot", "dataRoot"]) {
      for (const root of [installed, path.join(alias, "missing child")]) {
        await writeFile(userConfigPath, JSON.stringify({ [field]: root }));
        await assert.rejects(
          readLocationConfiguration({ userConfigPath, resources: local }),
          /outside the skill installation/
        );
      }
    }
    await writeFile(userConfigPath, "{}");
    await writeFile(path.join(installed, "selected.json"), "{}");
    await assert.rejects(
      readLocationConfiguration({
        userConfigPath,
        projectConfigPath: path.join(alias, "selected.json"),
        resources: local
      }),
      /outside the skill installation/
    );
    assert.deepEqual((await readdir(installed)).sort(), [
      "scripts",
      "selected.json"
    ]);
  }));
