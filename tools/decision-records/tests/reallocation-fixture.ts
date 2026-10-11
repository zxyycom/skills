import fs from "node:fs/promises";
import path from "node:path";
import { scanDecisionRecords } from "../src/scan.ts";
import { isEstablishedDecisionRecord } from "../src/types.ts";
import { candidateDecisionBody } from "./support.ts";

/** Complete Markdown ring: archived predecessors and sparse active successors. */
export async function writeReallocationRing(root: string, count: number) {
  const predecessorIds = Array.from(
    { length: count },
    (_, index) => `261001-p-${String(index).padStart(4, "0")}`
  );
  const successorIds = Array.from(
    { length: count },
    (_, index) => `261002-s-${String(index).padStart(4, "0")}`
  );
  const directory = path.join(root, "docs/decisions");
  await fs.mkdir(path.join(directory, "archive"), { recursive: true });
  for (const [index, id] of [...predecessorIds, ...successorIds].entries()) {
    const archived = index < count;
    const relations = archived
      ? []
      : [
          predecessorIds[index - count]!,
          predecessorIds[(index - count + 1) % count]!
        ].map((target) => ({ type: "重划", target }));
    const text = candidateDecisionBody({ id, relations })
      .replace(
        "status: candidate",
        `status: ${archived ? "archived" : "active"}`
      )
      .replace("alignment: null", "alignment: aligned")
      .replace(
        "createdAt: null",
        `createdAt: ${archived ? "2026-10-01" : "2026-10-02"}T00:00:00Z`
      );
    await fs.writeFile(
      path.join(directory, archived ? "archive" : "", id + ".md"),
      text
    );
  }
  const scan = await scanDecisionRecords({ workspaceRoot: root });
  const records = scan.records.filter(isEstablishedDecisionRecord);
  return { predecessorIds, successorIds, scan, records };
}
