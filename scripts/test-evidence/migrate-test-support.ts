import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const expectedSource = {
  projectId: "fixture-project",
  revision: "fixture-revision",
  scopeId: "fixture-tests"
};

export async function withLegacyWorkspace(
  action: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "migration-fixture-")
  );
  try {
    const root = path.join(workspaceRoot, "docs/test-evidence");
    await fs.mkdir(path.join(root, "access-control"), { recursive: true });
    await fs.writeFile(
      path.join(root, "test-evidence-topics.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          topics: [
            { id: "access-control", description: "Authorization boundaries." }
          ]
        },
        null,
        2
      )
    );
    await fs.writeFile(
      path.join(root, "test-evidence-index.json"),
      '{"legacy":true}\n',
      { mode: 0o640 }
    );
    await fs.writeFile(
      path.join(root, "access-control/auth-role-access.md"),
      legacyCase
    );
    await action(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

export function fixtureSnapshot(): {
  completeness: "complete";
  entities: { id: string; locators: string[]; name: string }[];
  schemaVersion: 2;
  source: typeof expectedSource;
} {
  return {
    completeness: "complete",
    entities: [
      {
        id: "test:alpha",
        locators: ["tests/access.test.ts > rejects guest mutation"],
        name: "rejects guest mutation"
      },
      {
        id: "test:beta",
        locators: ["tests/access.test.ts > preserves resource"],
        name: "preserves resource"
      }
    ],
    schemaVersion: 2,
    source: expectedSource
  };
}

export const legacyCase = `### Case AUTH-ROLE-ACCESS-001: Guest access is rejected

Entry:
- \`tests/access.test.ts > rejects guest mutation\`
- \`bun test --test-name-pattern="^rejects guest mutation$" ./tests/access.test.ts\`
- \`tests/access.test.ts > preserves resource\`

Contract:
- Resource mutation follows the caller role boundary.

Proves:
- A guest mutation returns the forbidden result.
- The resource remains unchanged.
`;
