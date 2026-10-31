import { expectResourceRejectionBeforeBytes } from "./phases/resource-phase-test-support.ts";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";

import { investigationRoot, withTempRoot } from "../support/fixture-support.ts";

const resource = "docs/investigations/_resources/one/nested/member.txt";
async function prepare(root: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, resource)), { recursive: true });
  await fs.writeFile(path.join(root, resource), "identical bytes\n");
}

for (const component of ["root", "owner", "intermediate"]) {
  test(`directory phase identity rejects same-byte ordinary ${component} replacement before source bytes`, async () => {
    await withTempRoot("ordinary-directory-identity", async (root) => {
      await prepare(root);
      const resources = path.join(investigationRoot(root), "_resources");
      const target =
        component === "root"
          ? resources
          : component === "owner"
            ? path.join(resources, "one")
            : path.join(resources, "one/nested");
      const original = fs.readdir;
      let replaced = false;
      fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
        const entries = await original(...args);
        if (args[0] === target && !replaced) {
          replaced = true;
          await fs.rename(target, path.join(root, "saved-directory"));
          await fs.mkdir(path.dirname(path.join(root, resource)), {
            recursive: true
          });
          await fs.writeFile(path.join(root, resource), "identical bytes\n");
        }
        return entries;
      }) as typeof fs.readdir;
      try {
        await expectResourceRejectionBeforeBytes(
          root,
          resource,
          () => replaced
        );
      } finally {
        fs.readdir = original;
      }
    });
  });
}

test("resource safety rejects same-byte ordinary file replacement after opening before source bytes", async () => {
  await withTempRoot("ordinary-file-identity", async (root) => {
    await prepare(root);
    const target = path.join(root, resource);
    const original = fs.open;
    let replaced = false;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      const handle = await original(...args);
      if (args[0] === target && !replaced) {
        replaced = true;
        await fs.rename(target, path.join(root, "saved-file"));
        await fs.writeFile(target, "identical bytes\n");
      }
      return handle;
    }) as typeof fs.open;
    try {
      await expectResourceRejectionBeforeBytes(root, resource, () => replaced);
    } finally {
      fs.open = original;
    }
  });
});
