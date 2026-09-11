import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  decisionDefinition,
  decisionStates,
  type DecisionState,
  type MemoryStateSource
} from "./support.ts";

export async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "state-index-store-")
  );
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

export async function createDecisionFixture() {
  const source: MemoryStateSource<DecisionState> = {
    revision: "decision-revision-1",
    states: await decisionStates()
  };
  return { definition: decisionDefinition(source), source };
}
