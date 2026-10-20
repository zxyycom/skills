import { investigationIdFromMarkdown } from "../src/markdown.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { unrecordedPredecessorWarnings } from "../src/validation-history.ts";
import { loadInvestigationIndex } from "../src/investigation-state-index.ts";
import { git, initializeGit } from "./git-support.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

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

for (const identity of [
  "legacy",
  "moved",
  "inconsistent-index",
  "missing-index",
  "malformed-index"
]) {
  test(`history prefixes use real source presence for ${identity} HEAD identities`, async () => {
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
      if (identity === "missing-index")
        await fs.rm(path.join(directory, "investigation-index.json"));
      if (identity === "malformed-index")
        await fs.writeFile(
          path.join(directory, "investigation-index.json"),
          "not valid JSON\n"
        );
      initializeGit(root);
      if (identity === "moved") await fs.rm(path.join(directory, "renamed.md"));
      await writeCollection(root, [
        { id: "base" },
        { id: "next", relations: [{ type: "补充", target: "base" }] }
      ]);
      const result = await warnings(root);
      if (identity === "inconsistent-index") {
        assert.equal(result.length, 1);
        assert.match(result[0]!, /前序报告 base 尚未进入 Git HEAD/u);
      } else assert.deepEqual(result, []);
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

test("history prefix UTF8 cutoff after complete identity lines does not cause a false missing warning", async () => {
  await withTempRoot("history-prefix-utf8", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ type: "补充", target: "base" }] }
    ]);
    const head = Buffer.from('---\ntitle: "UTF8"\nid: "base"\n');
    const fill = Buffer.alloc(16384 - head.length - 1, 0x61);
    await fs.writeFile(
      path.join(investigationRoot(root), "base.md"),
      Buffer.concat([head, fill, Buffer.from("字\n")])
    );
    initializeGit(root);
    assert.deepEqual(await warnings(root), []);
  });
});

for (const failure of ["missing", "corrupt"]) {
  test(`history bounded retention keeps unavailable warnings for unrelated formal ${failure} objects`, async () => {
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
      if (failure === "missing") await fs.unlink(object);
      else {
        const bytes = await fs.readFile(object);
        await fs.chmod(object, 0o600);
        await fs.writeFile(object, bytes.subarray(0, bytes.length - 8));
      }
      const result = await warnings(root);
      assert.equal(result.length, 1);
      assert.match(result[0]!, /history-check-unavailable/u);
      assert.ok(!result[0]!.includes("尚未进入 Git HEAD"));
    });
  });
}
