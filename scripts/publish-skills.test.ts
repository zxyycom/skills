import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const publisherPath = path.join(repositoryRoot, "scripts", "publish-skills.ts");
const packageHash = "a".repeat(64);
const commitSha = "b".repeat(40);

type PublishedAsset = {
  digest: string | null;
  name: string;
  size: number;
};

type LoggedCommand = {
  arguments: string[];
  tool: "gh" | "git";
};

type PublisherRun = {
  commands: LoggedCommand[];
  status: number | null;
  stderr: string;
  stdout: string;
};

type TestHarness = {
  root: string;
  run: (
    mode: "rolling" | "snapshot",
    releases?: Readonly<Record<string, readonly PublishedAsset[]>>
  ) => Promise<PublisherRun>;
};

test("rolling publication replaces packages before manifest and removes stale assets", async () => {
  await withHarness("complete", async ({ root, run }) => {
    const result = await run("rolling", {
      "skills-latest": [
        { digest: null, name: "alpha.zip", size: 1 },
        { digest: null, name: "removed.zip", size: 2 },
        { digest: null, name: "skill-release-manifest.json", size: 3 }
      ]
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Skill Release updated: skills-latest/u);
    assert.deepEqual(result.commands.map(commandAction), [
      "gh:view",
      "git:tag",
      "git:push",
      "gh:upload",
      "gh:upload",
      "gh:delete-asset",
      "gh:edit"
    ]);

    const uploads = result.commands.filter(
      (command) => commandAction(command) === "gh:upload"
    );
    assert.deepEqual(assetNames(uploads[0], root), ["alpha.zip", "beta.zip"]);
    assert.deepEqual(assetNames(uploads[1], root), [
      "skill-release-manifest.json"
    ]);
    const deleted = result.commands.find(
      (command) => commandAction(command) === "gh:delete-asset"
    );
    assert.equal(deleted?.arguments.includes("removed.zip"), true);
  });
});

test("rolling publication creates a verified latest release when absent", async () => {
  await withHarness("complete", async ({ root, run }) => {
    const result = await run("rolling");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Skill Release created: skills-latest/u);
    assert.deepEqual(result.commands.map(commandAction), [
      "gh:view",
      "git:tag",
      "git:push",
      "gh:create"
    ]);
    const create = result.commands.at(-1);
    assert.equal(create?.arguments.includes("--latest"), true);
    assert.equal(create?.arguments.includes("--verify-tag"), true);
    assert.deepEqual(assetNames(create, root), [
      "alpha.zip",
      "beta.zip",
      "skill-release-manifest.json"
    ]);
  });
});

test("snapshot publication creates once and reuses matching digests", async () => {
  await withHarness("complete", async ({ root, run }) => {
    const tag = `skills-${packageHash.slice(0, 12)}`;
    const created = await run("snapshot");
    assert.equal(created.status, 0);
    assert.deepEqual(created.commands.map(commandAction), [
      "gh:view",
      "gh:create"
    ]);
    const create = created.commands.at(-1);
    assert.equal(create?.arguments.includes("--latest=false"), true);
    assert.equal(optionValue(create, "--target"), commitSha);

    const reused = await run("snapshot", {
      [tag]: await publishedAssets(root)
    });
    assert.equal(reused.status, 0);
    assert.match(
      reused.stdout,
      new RegExp(`Skill Release reused: ${tag}`, "u")
    );
    assert.deepEqual(reused.commands.map(commandAction), ["gh:view"]);
  });
});

test("snapshot publication rejects conflicting assets without remote writes", async () => {
  await withHarness("complete", async ({ root, run }) => {
    const tag = `skills-${packageHash.slice(0, 12)}`;
    const assets = await publishedAssets(root);
    const first = assets[0];
    if (first === undefined) {
      assert.fail("Expected fixture assets");
    }

    const result = await run("snapshot", {
      [tag]: [
        { ...first, digest: `sha256:${"0".repeat(64)}` },
        ...assets.slice(1)
      ]
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /exists with different assets/u);
    assert.match(result.stderr, /digest/u);
    assert.deepEqual(result.commands.map(commandAction), ["gh:view"]);
  });
});

test("publication CLI rejects incomplete assets before starting commands", async () => {
  await withHarness("manifest-only", async ({ run }) => {
    const result = await run("rolling");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /at least one skill zip/u);
    assert.deepEqual(result.commands, []);
  });
});

async function withHarness(
  fixture: "complete" | "manifest-only",
  run: (harness: TestHarness) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "publish-skills-test-"));
  try {
    await writeFixture(root, fixture);
    const toolPath = await writeFakeTools(root);
    const releaseStatePath = path.join(root, "release-state.json");
    const commandLogPath = path.join(root, "command-log.jsonl");

    await run({
      root,
      run: async (mode, releases = {}) => {
        await fs.writeFile(releaseStatePath, JSON.stringify(releases), "utf8");
        await fs.writeFile(commandLogPath, "", "utf8");
        const result = spawnSync(process.execPath, [publisherPath, mode], {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            FAKE_COMMAND_LOG: commandLogPath,
            FAKE_RELEASE_STATE: releaseStatePath,
            GH_TOKEN: "test-token",
            GITHUB_SHA: commitSha,
            PACKAGE_HASH: packageHash,
            PATH: `${toolPath}${path.delimiter}${process.env.PATH ?? ""}`
          },
          stdio: "pipe",
          windowsHide: true
        });
        return {
          commands: await readCommandLog(commandLogPath),
          status: result.status,
          stderr: result.stderr,
          stdout: result.stdout
        };
      }
    });
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
}

async function writeFixture(
  root: string,
  fixture: "complete" | "manifest-only"
): Promise<void> {
  const dist = path.join(root, "dist");
  await fs.mkdir(dist);
  await fs.writeFile(
    path.join(dist, "skill-release-manifest.json"),
    '{"skills":{}}\n'
  );
  if (fixture === "complete") {
    await Promise.all([
      fs.writeFile(path.join(dist, "alpha.zip"), "alpha package\n"),
      fs.writeFile(path.join(dist, "beta.zip"), "beta package\n")
    ]);
  }
}

async function writeFakeTools(root: string): Promise<string> {
  const bin = path.join(root, "bin");
  await fs.mkdir(bin);
  const dispatcher = path.join(bin, "fake-tool.mjs");
  await fs.writeFile(
    dispatcher,
    [
      'import fs from "node:fs";',
      "const [tool, ...arguments_] = process.argv.slice(2);",
      'fs.appendFileSync(process.env.FAKE_COMMAND_LOG, JSON.stringify({ tool, arguments: arguments_ }) + "\\n");',
      'if (tool === "gh" && arguments_[0] === "release" && arguments_[1] === "view") {',
      "  const tag = arguments_[2];",
      '  const releases = JSON.parse(fs.readFileSync(process.env.FAKE_RELEASE_STATE, "utf8"));',
      "  const assets = releases[tag];",
      '  if (assets === undefined) { console.error("release not found"); process.exit(1); }',
      "  console.log(JSON.stringify({ tagName: tag, assets }));",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );

  for (const tool of ["gh", "git"] as const) {
    if (process.platform === "win32") {
      await fs.writeFile(
        path.join(bin, `${tool}.cmd`),
        `@${quoteBatch(process.execPath)} ${quoteBatch(dispatcher)} ${tool} %*\r\n`,
        "utf8"
      );
    } else {
      const executable = path.join(bin, tool);
      await fs.writeFile(
        executable,
        [
          "#!/bin/sh",
          `exec ${quoteShell(process.execPath)} ${quoteShell(dispatcher)} ${tool} "$@"`,
          ""
        ].join("\n"),
        "utf8"
      );
      await fs.chmod(executable, 0o755);
    }
  }
  return bin;
}

async function publishedAssets(root: string): Promise<PublishedAsset[]> {
  const dist = path.join(root, "dist");
  const names = (await fs.readdir(dist)).sort();
  return Promise.all(
    names.map(async (name) => {
      const data = await fs.readFile(path.join(dist, name));
      return {
        digest: `sha256:${createHash("sha256").update(data).digest("hex")}`,
        name,
        size: data.byteLength
      };
    })
  );
}

async function readCommandLog(logPath: string): Promise<LoggedCommand[]> {
  return (await fs.readFile(logPath, "utf8"))
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LoggedCommand);
}

function commandAction(command: LoggedCommand): string {
  return command.tool === "git"
    ? `git:${command.arguments[0] ?? "unknown"}`
    : `gh:${command.arguments[1] ?? "unknown"}`;
}

function assetNames(
  command: LoggedCommand | undefined,
  root: string
): string[] {
  if (command === undefined) {
    return [];
  }
  const dist = path.join(root, "dist") + path.sep;
  return command.arguments
    .filter((argument) => argument.startsWith(dist))
    .map((argument) => path.basename(argument));
}

function optionValue(
  command: LoggedCommand | undefined,
  option: string
): string | undefined {
  if (command === undefined) {
    return undefined;
  }
  const index = command.arguments.indexOf(option);
  return index === -1 ? undefined : command.arguments[index + 1];
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function quoteBatch(value: string): string {
  return `"${value.replaceAll("%", "%%").replaceAll('"', '""')}"`;
}
