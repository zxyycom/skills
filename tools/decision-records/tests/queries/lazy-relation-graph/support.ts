import type { DecisionQueryRequest } from "../../../src/query/decision-query-contract.ts";

export function listRequest(
  root: string
): Extract<DecisionQueryRequest, { command: "list" }> {
  return {
    alignment: "all",
    command: "list",
    limit: 10,
    location: { decisionsDir: "docs/decisions", workspaceRoot: root },
    offset: 0,
    status: "all",
    tags: []
  };
}
