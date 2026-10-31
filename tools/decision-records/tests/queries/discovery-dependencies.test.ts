import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { assertDiscoveryDependencyContract } from "../../../record-operations/tests/query-contract.ts";
import { executeDecisionQuery } from "../../src/query/decision-query-service.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  currentSourcePath,
  runSourceCli,
  withFixtureWorkspace
} from "../support/support.ts";

test("Decision discovery verifies only actual dependencies and reads complete safe source bytes", async () => {
  await withFixtureWorkspace("discovery-dependencies", async (root) => {
    const location = { workspaceRoot: root, decisionsDir: "docs/decisions" };
    const base = {
      location,
      alignment: "all" as const,
      status: "all" as const,
      tags: []
    };
    await assertDiscoveryDependencyContract({
      root,
      collection: location.decisionsDir,
      sourcePath: currentSourcePath,
      poisonPublishedGraph: async () => {
        const target = path.join(root, "docs/decisions/decision-index.json");
        const index = JSON.parse(await fs.readFile(target, "utf8"));
        index.entries[currentDecisionId].relations[0].target = "missing";
        await fs.writeFile(target, `${JSON.stringify(index, null, 2)}\n`);
      },
      query: async (command) => {
        const result =
          command === "list" || command === "related"
            ? await executeDecisionQuery({
                ...base,
                command: "list",
                limit: 2,
                offset: 0,
                ...(command === "related"
                  ? { relatedTo: archivedDecisionId }
                  : {})
              })
            : command === "show" || command === "trace"
              ? await executeDecisionQuery({
                  location,
                  command,
                  decisionId: currentDecisionId
                })
              : await executeDecisionQuery({
                  ...base,
                  command: "search",
                  in: command === "metadata" ? "metadata" : "content",
                  text: "Markdown",
                  match: "any",
                  ...(command === "metadata" ? { limit: 1 } : {})
                });
        return {
          ok: result.status === "ok",
          ...("body" in result ? { body: result.body } : {})
        };
      },
      showCli: async () => {
        const shown = await runSourceCli([
          "show",
          currentDecisionId,
          "--root",
          root
        ]);
        return { ok: shown.exitCode === 0, body: shown.stdout };
      },
      queryLocation: async (workspaceRoot, decisionsDir) => {
        const result = await executeDecisionQuery({
          ...base,
          location: { workspaceRoot, decisionsDir },
          command: "list",
          limit: 1,
          offset: 0
        });
        return { ok: result.status === "ok" };
      }
    });
  });
});
