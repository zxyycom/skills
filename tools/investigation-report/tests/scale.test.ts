import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadCurrentInvestigationIndex } from "../src/investigation-state-index.ts";
import { queryInvestigationIndex } from "../src/query.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRoot,
  reportMarkdown,
  resultValue,
  type ReportInput,
  withTempRoot
} from "./support.ts";

const scaleTopicCount = 1_000;
const writeBatchSize = 64;

async function writeScaleTopics(workspaceRoot: string): Promise<void> {
  const topicRoot = path.join(investigationRoot(workspaceRoot), "scale");
  await fs.mkdir(topicRoot, { recursive: true });
  for (let offset = 0; offset < scaleTopicCount; offset += writeBatchSize) {
    await Promise.all(
      Array.from(
        {
          length: Math.min(writeBatchSize, scaleTopicCount - offset)
        },
        async (_, index) => {
          const number = String(offset + index).padStart(4, "0");
          const input: ReportInput = {
            path: `scale/report-${number}.md`,
            question: `第 ${number} 份调查能否进入通用索引？`,
            title: `规模调查 ${number}`
          };
          await fs.writeFile(
            path.join(topicRoot, `report-${number}.md`),
            reportMarkdown(input),
            "utf8"
          );
        }
      )
    );
  }
}

async function testScaleEvidence(): Promise<void> {
  await withTempRoot("scale", async (workspaceRoot) => {
    await writeScaleTopics(workspaceRoot);

    const syncStartedAt = performance.now();
    const synchronized = await synchronizeInvestigationIndex({
      workspaceRoot
    });
    const syncMilliseconds = performance.now() - syncStartedAt;
    assert.deepEqual(synchronized.errors, []);
    assert.equal(synchronized.topicCount, scaleTopicCount);

    const readStartedAt = performance.now();
    const index = resultValue(await loadCurrentInvestigationIndex({
      investigationsDirectory: investigationRoot(workspaceRoot)
    }));
    const readMilliseconds = performance.now() - readStartedAt;
    assert.equal(index.entries.length, scaleTopicCount);

    const queryStartedAt = performance.now();
    const query = await queryInvestigationIndex({
      limit: 10,
      text: "规模 调查",
      workspaceRoot
    });
    const queryMilliseconds = performance.now() - queryStartedAt;
    assert.deepEqual(query.errors, []);
    assert.equal(query.total, scaleTopicCount);
    assert.equal(query.entries.length, 10);

    console.log(
      "Investigation index scale evidence: "
      + `${scaleTopicCount} topics synchronized in ${syncMilliseconds.toFixed(1)} ms, `
      + `freshness-read in ${readMilliseconds.toFixed(1)} ms, `
      + `freshness-query in ${queryMilliseconds.toFixed(1)} ms.`
    );
  });
}

test("index synchronizes and queries one thousand investigation reports", () => (
  testScaleEvidence()
));
