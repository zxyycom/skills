import { investigationIdFromMarkdown } from "../../src/records/markdown.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { unrecordedPredecessorWarnings } from "../../src/records/validation/validation-history.ts";
import { loadInvestigationIndex } from "../../src/index/investigation-state-index.ts";
import { git, initializeGit } from "../support/git-support.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "../support/fixture-support.ts";
import { writeCollection } from "../support/collection-support.ts";

async function warnings(root: string): Promise<string[]> {
  const loaded = await loadInvestigationIndex({
    investigationsDirectory: investigationRoot(root)
  });
  assert.ok(loaded.status === "ok");
  return await unrecordedPredecessorWarnings(
    investigationRoot(root),
    new Map(Object.entries(loaded.value.entries))
  );
}

for (const failure of ["json", "definition", "utf8"]) {
  test(`history invalid ${failure} index reports HEAD diagnostics until a repair is committed`, async () => {
    await withTempRoot("history-invalid-index", async (root) => {
      await writeCollection(root, [
        { id: "base" },
        { id: "next", relations: [{ type: "补充", target: "base" }] }
      ]);
      initializeGit(root);
      assert.deepEqual(await warnings(root), []);

      const indexPath = "docs/investigations/investigation-index.json";
      const indexFile = path.join(root, indexPath);
      const healthy = await fs.readFile(indexFile, "utf8");
      const invalid =
        failure === "json"
          ? healthy.trimEnd().slice(0, -1)
          : healthy.replace(
              /"definitionVersion": \d+/u,
              '"definitionVersion": 999'
            );
      await fs.writeFile(
        indexFile,
        failure === "utf8"
          ? Buffer.concat([
              Buffer.from(healthy.slice(0, 10)),
              Buffer.from([0xff]),
              Buffer.from(healthy.slice(11))
            ])
          : invalid
      );
      git(root, ["add", indexPath]);
      git(root, ["commit", "--quiet", "-m", "invalid historical index"]);
      const revision = git(root, ["rev-parse", "HEAD"]).trim();
      await fs.writeFile(indexFile, healthy);

      const result = await warnings(root);
      assert.equal(result.length, 1);
      const warning = result[0]!;
      assert.match(warning, /investigation-report\.history-check-unavailable/u);
      assert.ok(warning.includes(`revision: ${revision}`));
      assert.ok(warning.includes(`path: ${JSON.stringify(indexPath)}`));
      assert.match(
        warning,
        failure === "json"
          ? /cause: \[state-index\.json-invalid\]; detail: \S/u
          : failure === "utf8"
            ? /record-operations\.history-index-utf8-invalid/u
            : /\[state-index\.definition-version-mismatch\].*expected definition version.*found 999/u
      );
      assert.match(
        warning,
        failure !== "definition"
          ? /next:.*commit.*HEAD baseline/u
          : /next:.*compatibility.*migration/u
      );
      assert.doesNotMatch(warning, /前序报告 base 尚未进入/u);

      git(root, ["add", indexPath]);
      git(root, ["commit", "--quiet", "-m", "repair historical index"]);
      assert.deepEqual(await warnings(root), []);
    });
  });
}

for (const newline of ["lf", "crlf", "cr"]) {
  test(`history identity accepts ${newline} first-three-line source prefixes`, () => {
    const separator =
      newline === "lf" ? "\n" : newline === "crlf" ? "\r\n" : "\r";
    const text = (
      '---\ntitle: "base"\nid: "base"\n' + "unneeded body bytes\n".repeat(2000)
    ).replaceAll("\n", separator);
    const prefix = Buffer.from(text).subarray(0, 16384).toString("utf8");
    assert.equal(investigationIdFromMarkdown(prefix), "base");
  });
}

for (const identity of ["legacy", "moved", "inconsistent-index"]) {
  test(`history indexed lookup diagnoses unavailable ${identity} HEAD identities`, async () => {
    await withTempRoot("history-prefix-source-presence", async (root) => {
      await writeCollection(root, [
        { id: "base" },
        { id: "next", relations: [{ type: "补充", target: "base" }] }
      ]);
      const directory = investigationRoot(root);
      if (identity === "legacy")
        await fs.writeFile(
          path.join(directory, "base.md"),
          "historical legacy body\n"
        );
      if (identity === "moved")
        await fs.rename(
          path.join(directory, "base.md"),
          path.join(directory, "renamed.md")
        );
      if (identity === "inconsistent-index")
        await fs.writeFile(
          path.join(directory, "base.md"),
          reportMarkdown({ id: "other" })
        );
      initializeGit(root);
      if (identity === "moved") await fs.rm(path.join(directory, "renamed.md"));
      await writeCollection(root, [
        { id: "base" },
        { id: "next", relations: [{ type: "补充", target: "base" }] }
      ]);
      const result = await warnings(root);
      assert.equal(result.length, 1);
      assert.match(result[0]!, /history-check-unavailable/u);
    });
  });
}

test("history long first-three-line prefixes fall back to the exact revision file and preserve EOF identity", async () => {
  await withTempRoot("history-prefix-long-line", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ type: "补充", target: "base" }] }
    ]);
    await fs.writeFile(
      path.join(investigationRoot(root), "base.md"),
      `---\ntitle: "${"字".repeat(18000)}"\nid: "base"`
    );
    initializeGit(root);
    assert.deepEqual(await warnings(root), []);
  });
});

test("history identity survives UTF8 cutoff after complete identity lines", () => {
  const head = Buffer.from('---\ntitle: "UTF8"\nid: "base"\n');
  const fill = Buffer.alloc(16384 - head.length - 1, 0x61);
  const source = Buffer.concat([head, fill, Buffer.from("字\n")]);
  const prefix = source.subarray(0, 16384).toString("utf8");
  assert.ok(prefix.endsWith("\uFFFD"));
  assert.equal(investigationIdFromMarkdown(prefix), "base");
});

for (const failure of ["corrupt"]) {
  test(`history indexed lookup ignores unrelated formal ${failure} objects`, async () => {
    await withTempRoot("history-prefix-object-failure", async (root) => {
      await writeCollection(root, [
        { id: "base" },
        { id: "other" },
        { id: "next", relations: [{ type: "补充", target: "base" }] }
      ]);
      initializeGit(root);
      const oid = git(root, [
        "rev-parse",
        "HEAD:docs/investigations/other.md"
      ]).trim();
      const object = path.join(
        root,
        ".git/objects",
        oid.slice(0, 2),
        oid.slice(2)
      );
      {
        const bytes = await fs.readFile(object);
        await fs.chmod(object, 0o600);
        await fs.writeFile(object, bytes.subarray(0, bytes.length - 8));
      }
      const result = await warnings(root);
      assert.deepEqual(result, []);
    });
  });
}

test("history CLI escapes control characters in the historical target path", async () => {
  const { spawnSync } = await import("node:child_process");
  await withTempRoot("history-control-path", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ type: "补充", target: "base" }] }
    ]);
    const directory = "inv\nFORGED\u001b";
    await fs.rename(investigationRoot(root), path.join(root, directory));
    initializeGit(root);
    const index = path.join(root, directory, "investigation-index.json");
    const healthy = await fs.readFile(index);
    await fs.writeFile(index, "{broken");
    git(root, ["add", `${directory}/investigation-index.json`]);
    git(root, ["commit", "--quiet", "-m", "broken historical index"]);
    await fs.writeFile(index, healthy);
    const cli = spawnSync(
      "node",
      [
        path.resolve("tools/investigation-report/src/cli.ts"),
        "check",
        "--root",
        root,
        "--investigations-dir",
        directory
      ],
      { encoding: "utf8" }
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stderr, /history-check-unavailable/u);
    assert.match(cli.stderr, /inv\\nFORGED\\u001b/u);
    assert.ok(!cli.stderr.includes("\nFORGED"));
    assert.ok(!cli.stderr.includes(String.fromCharCode(27)));
  });
});

test(
  "history warning preserves revision and system evidence when missing-index enumeration fails",
  { skip: process.platform === "win32" },
  async () => {
    const { execFileSync, spawnSync } = await import("node:child_process");
    await withTempRoot("history-missing-enumeration", async (root) => {
      await writeCollection(root, [
        { id: "base" },
        { id: "next", relations: [{ type: "补充", target: "base" }] }
      ]);
      initializeGit(root);
      const indexPath = "docs/investigations/investigation-index.json";
      git(root, ["rm", "--cached", indexPath]);
      git(root, ["commit", "--quiet", "-m", "missing index"]);
      const revision = git(root, ["rev-parse", "HEAD"]).trim();
      const realGit = execFileSync("which", ["git"], {
        encoding: "utf8"
      }).trim();
      const bin = path.join(root, "bin");
      await fs.mkdir(bin);
      await fs.writeFile(
        path.join(bin, "git"),
        `#!/bin/sh\ncase " $* " in *" ls-tree "*" --name-only "*) echo 'enumeration denied' >&2; exit 1;; esac\nexec ${JSON.stringify(realGit)} "$@"\n`,
        { mode: 0o755 }
      );
      const cli = spawnSync(
        "node",
        [
          path.resolve("tools/investigation-report/src/cli.ts"),
          "check",
          "--root",
          root
        ],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH }
        }
      );
      assert.equal(cli.status, 0, cli.stderr);
      assert.match(cli.stderr, /history-check-unavailable/u);
      assert.ok(cli.stderr.includes(`revision: ${revision}`));
      assert.ok(cli.stderr.includes(`path: "${indexPath}"`));
      assert.match(cli.stderr, /cause: \[operation-failed\]/u);
      assert.match(
        cli.stderr,
        /versionControl\.causeCategory: command-failed/u
      );
      assert.match(
        cli.stderr,
        /versionControl\.operation: list files in the revision snapshot/u
      );
      assert.match(cli.stderr, /versionControl\.detail:.*enumeration denied/u);
    });
  }
);
