import { runInvestigationReportCheckCli } from "../../src/cli.ts";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { assertDiscoveryDependencyContract } from "../../../record-operations/tests/query-contract.ts";
import {
  queryInvestigationIndex,
  searchInvestigationReports,
  showInvestigationReport,
  traceInvestigationReports
} from "../../src/query/query.ts";
import { writeCollection } from "../support/collection-support.ts";
import { withTempRoot } from "../support/fixture-support.ts";

test("Investigation discovery verifies only actual dependencies and reads complete safe source bytes", async () => {
  await withTempRoot("discovery-dependencies", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ type: "补充", target: "base" }] }
    ]);
    await assertDiscoveryDependencyContract({
      root,
      collection: "docs/investigations",
      sourcePath: "next.md",
      poisonPublishedGraph: async () => {
        const target = path.join(
          root,
          "docs/investigations/investigation-index.json"
        );
        const index = JSON.parse(await fs.readFile(target, "utf8"));
        index.entries.next.relations[0].target = "missing";
        index.entries.base.resourceIds = ["unknown/evidence.txt"];
        await fs.writeFile(target, `${JSON.stringify(index, null, 2)}\n`);
      },
      query: async (command) => {
        if (command === "show") {
          const result = await showInvestigationReport({
            workspaceRoot: root,
            id: "next"
          });
          return {
            ok: result.status === "ok",
            body: result.markdown ?? undefined
          };
        }
        if (command === "trace") {
          const result = await traceInvestigationReports({
            workspaceRoot: root,
            id: "next"
          });
          return { ok: result.status === "ok" };
        }
        if (command === "list" || command === "related") {
          const result = await queryInvestigationIndex({
            workspaceRoot: root,
            limit: 1,
            ...(command === "related" ? { relatedTo: "base" } : {})
          });
          return { ok: result.errors.length === 0 };
        }
        const result = await searchInvestigationReports({
          workspaceRoot: root,
          query: "当前",
          in: command === "metadata" ? "metadata" : "content",
          limit: 1
        });
        return { ok: result.status === "ok" };
      },
      showCli: async () => {
        let stdout = "";
        const exit = await runInvestigationReportCheckCli(
          ["show", "next", "--root", root],
          {
            io: {
              stdout: (text) => {
                stdout += text;
              },
              stderr: () => undefined
            }
          }
        );
        return { ok: exit === 0, body: stdout };
      },
      queryLocation: async (workspaceRoot, investigationsDir) => {
        const result = await queryInvestigationIndex({
          workspaceRoot,
          investigationsDir
        });
        return { ok: result.errors.length === 0 };
      }
    });
  });
});
