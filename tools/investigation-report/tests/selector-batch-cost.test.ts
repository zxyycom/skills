import assert from "node:assert/strict";
import test from "node:test";
import { createInvestigationSelectorResolver } from "../src/investigation-selector.ts";

test("batch selector lookup reads entries once and preserves ambiguity and duplicates", () => {
  let reads = 0;
  const entries = Array.from({ length: 1000 }, (_, index) => ({
    get id() {
      reads++;
      return `241001-report-${index}`;
    },
    get name() {
      reads++;
      return `report-${index}`;
    }
  }));
  entries.push({ id: "241002-report-999", name: "report-999" });
  const resolve = createInvestigationSelectorResolver(entries);
  assert.equal(reads, 2000);
  for (let index = 0; index < 100; index++)
    assert.deepEqual(resolve(`report-${index}`), {
      id: `241001-report-${index}`,
      status: "ok"
    });
  assert.equal(reads, 2000);
  assert.deepEqual(resolve("report-999"), {
    errors: [
      "Investigation name is ambiguous: report-999; choose one standard ID: 241001-report-999, 241002-report-999"
    ],
    status: "error"
  });
  assert.deepEqual(resolve("241001-report-999"), {
    id: "241001-report-999",
    status: "ok"
  });
  assert.deepEqual(resolve("absent", "investigation candidate"), {
    errors: ["absent investigation candidate does not exist"],
    status: "error"
  });
  const duplicate = createInvestigationSelectorResolver([
    { id: "241001-same", name: "same" },
    { id: "241001-same", name: "same" }
  ]);
  assert.deepEqual(duplicate("same"), {
    errors: [
      "Investigation name is ambiguous: same; choose one standard ID: 241001-same, 241001-same"
    ],
    status: "error"
  });
});
