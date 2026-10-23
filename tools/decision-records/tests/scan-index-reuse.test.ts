import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords, validateDecisionScan } from "../src/index.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  currentSourcePath,
  decisionFilePath,
  withFixtureWorkspace
} from "./support.ts";

test("Decision scan reuse preserves stable source and index diagnostics", async () => {
  const changes = [
    async () => {},
    async (root: string) => {
      const file = path.join(root, "docs/decisions/decision-index.json");
      await fs.appendFile(file, " \n");
    },
    async (root: string) => {
      await fs.rm(path.join(root, "docs/decisions/decision-index.json"));
    },
    async (root: string) => {
      await fs.writeFile(
        path.join(root, "docs/decisions/decision-index.json"),
        "invalid JSON"
      );
    },
    async (root: string) => {
      await fs.appendFile(decisionFilePath(root, currentSourcePath), "\n");
    },
    async (root: string) => {
      const file = decisionFilePath(root, currentSourcePath);
      await fs.writeFile(
        file,
        (await fs.readFile(file, "utf8")).replace(
          "alignment: aligned",
          "alignment: null"
        )
      );
    }
  ];
  for (const change of changes) {
    await withFixtureWorkspace("scan-index-parity", async (root) => {
      await change(root);
      const scan = await scanDecisionRecords({ workspaceRoot: root });
      const separate = await validateDecisionScan(scan, {
        allowEmptyDecisionSet: true
      });
      const reused = await validateDecisionRecords({ workspaceRoot: root });
      assert.deepEqual(reused, separate);
    });
  }
});

test("Decision full check keeps first-acquired sources while reporting a subsequently damaged index", async () => {
  await withFixtureWorkspace("scan-index-drift", async (root) => {
    const file = decisionFilePath(root, currentSourcePath);
    const open = fs.open;
    let sourceReads = 0;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      const handle = await open(...args);
      if (args[0] === file) {
        const close = handle.close.bind(handle);
        handle.close = async () => {
          await close();
          if (++sourceReads === 1) {
            await fs.appendFile(file, "\n");
            await fs.writeFile(
              path.join(root, "docs/decisions/decision-index.json"),
              "damaged after scan"
            );
          }
        };
      }
      return handle;
    }) as typeof fs.open;
    try {
      const result = await validateDecisionRecords({ workspaceRoot: root });
      assert.deepEqual(result.scan.sourceErrors, []);
      assert.equal(sourceReads, 1);
      assert.match(result.errors.join("\n"), /out of sync/u);
      assert.doesNotMatch(result.errors.join("\n"), /source revision changed/u);
    } finally {
      fs.open = open;
    }
  });
});

test("Decision full check does not claim freshness after its source acquisition", async () => {
  await withFixtureWorkspace("scan-first-acquisition", async (root) => {
    const file = decisionFilePath(root, currentSourcePath);
    const open = fs.open;
    let reads = 0;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      const handle = await open(...args);
      if (args[0] === file) {
        const close = handle.close.bind(handle);
        handle.close = async () => {
          await close();
          if (++reads === 1) await fs.appendFile(file, "\n");
        };
      }
      return handle;
    }) as typeof fs.open;
    try {
      const result = await validateDecisionRecords({ workspaceRoot: root });
      assert.deepEqual(result.errors, []);
      assert.equal(reads, 1);
    } finally {
      fs.open = open;
    }
    const next = await validateDecisionRecords({ workspaceRoot: root });
    assert.match(next.errors.join("\n"), /out of sync/u);
  });
});

test("Decision validation of a caller-held scan still discovers current sources", async () => {
  await withFixtureWorkspace("scan-index-public-fresh", async (root) => {
    const scan = await scanDecisionRecords({ workspaceRoot: root });
    await fs.appendFile(decisionFilePath(root, currentSourcePath), "\n");
    const result = await validateDecisionScan(scan);
    assert.match(result.errors.join("\n"), /out of sync/u);
  });
});
