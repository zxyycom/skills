import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renameInvestigationRecordWithHooks } from "../../src/rename/rename.ts";

import { withTempRoot } from "../support/fixture-support.ts";

import { prepareLegacyOwnerRename } from "./rename-resource-fixture.ts";

test("Investigation resource recovery journals root and nested mkdir before chmod failures", async () => {
  for (const relative of ["", "nested"]) {
    await withTempRoot("resource-directory-journal", async (workspaceRoot) => {
      const fixture = await prepareLegacyOwnerRename(workspaceRoot);
      await fs.mkdir(path.join(fixture.oldOwner, "nested"), { mode: 0o700 });
      await fs.chmod(fixture.oldOwner, 0o700);
      const target = path.join(fixture.targetOwner, relative);
      const chmod = fs.chmod;
      let injected = false;
      fs.chmod = async (file, mode) => {
        if (!injected && String(file) === target) {
          injected = true;
          throw Object.assign(new Error("directory chmod failed"), {
            code: "EIO"
          });
        }
        await chmod(file, mode);
      };
      try {
        const result = await renameInvestigationRecordWithHooks({
          source: "legacy",
          target: "migrated",
          workspaceRoot
        });
        assert.equal(injected, true);
        assert.equal(result.status, "error");
        assert.equal(result.mutation?.outcome, "rolled-back");
        assert.equal(result.changed, false);
        await assert.rejects(fs.access(fixture.targetOwner), {
          code: "ENOENT"
        });
        assert.equal(
          await fs.readFile(fixture.reportPath, "utf8"),
          fixture.reportBefore
        );
        assert.equal(
          await fs.readFile(fixture.indexPath, "utf8"),
          fixture.indexBefore
        );
      } finally {
        fs.chmod = chmod;
      }
    });
  }
});

test("Investigation resource recovery retains unproved directory creation and later directory winners", async () => {
  for (const failure of ["identity", "winner"]) {
    await withTempRoot("resource-directory-unknown", async (workspaceRoot) => {
      const fixture = await prepareLegacyOwnerRename(workspaceRoot);
      const mkdir = fs.mkdir;
      const lstat = fs.lstat;
      const chmod = fs.chmod;
      let created = false;
      fs.mkdir = (async (...args: Parameters<typeof fs.mkdir>) => {
        const result = await mkdir(...args);
        if (String(args[0]) === fixture.targetOwner) created = true;
        return result;
      }) as typeof fs.mkdir;
      fs.lstat = (async (...args: Parameters<typeof fs.lstat>) => {
        if (
          failure === "identity" &&
          created &&
          String(args[0]) === fixture.targetOwner
        ) {
          created = false;
          throw Object.assign(new Error("new directory identity unavailable"), {
            code: "EIO"
          });
        }
        return await lstat(...args);
      }) as typeof fs.lstat;
      fs.chmod = async (file, mode) => {
        if (failure === "winner" && String(file) === fixture.targetOwner) {
          await fs.rmdir(fixture.targetOwner);
          await mkdir(fixture.targetOwner);
          await fs.writeFile(
            path.join(fixture.targetOwner, "winner.txt"),
            "external directory winner\n"
          );
          throw Object.assign(
            new Error("chmod interrupted by directory winner"),
            { code: "EIO" }
          );
        }
        await chmod(file, mode);
      };
      try {
        const result = await renameInvestigationRecordWithHooks({
          source: "legacy",
          target: "migrated",
          workspaceRoot
        });
        assert.equal(result.status, "error");
        assert.equal(result.mutation?.outcome, "partial-or-unknown");
        assert.equal(result.changed, true);
        assert.equal((await fs.stat(fixture.targetOwner)).isDirectory(), true);
        if (failure === "winner")
          assert.equal(
            await fs.readFile(
              path.join(fixture.targetOwner, "winner.txt"),
              "utf8"
            ),
            "external directory winner\n"
          );
        assert.equal(
          await fs.readFile(fixture.reportPath, "utf8"),
          fixture.reportBefore
        );
        assert.equal(
          await fs.readFile(fixture.indexPath, "utf8"),
          fixture.indexBefore
        );
      } finally {
        fs.mkdir = mkdir;
        fs.lstat = lstat;
        fs.chmod = chmod;
      }
    });
  }
});
