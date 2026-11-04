import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diagnosticFromError,
  diagnosticFromStateIndexDiagnostic,
  genericInvestigationDiagnostic,
  renderInvestigationDiagnostic,
  type InvestigationDiagnostic,
  type InvestigationDiagnosticSource
} from "../../src/diagnostics.ts";

test("diagnostic adapters retain the same structured revision context", () => {
  const source: InvestigationDiagnosticSource = {
    kind: "git-revision",
    revision: "a".repeat(40),
    path: "docs/investigations/investigation-index.json"
  };
  const context = {
    code: "investigation-report.history-check-unavailable",
    reason: "historical baseline unavailable",
    recovery: "inspect the reported cause",
    source,
    target: "investigation collection"
  };
  const causes = [{ code: "state-index.json-invalid", detail: "invalid JSON" }];
  const domain = genericInvestigationDiagnostic({ ...context, causes });
  const system = diagnosticFromError({
    ...context,
    error: Object.assign(new Error("read denied"), { code: "EACCES" })
  });
  const results = [
    domain,
    system,
    diagnosticFromStateIndexDiagnostic(
      {
        code: "state-index.json-invalid",
        message: "invalid JSON",
        path: source.path,
        stateId: null
      },
      context
    )
  ];
  for (const result of results) {
    assert.deepEqual(result.source, source);
    assert.equal(result.recovery, context.recovery);
  }
  assert.deepEqual(domain.causes, causes);
  assert.equal(system.causeCategory, "access-denied");
});

test("diagnostic rendering preserves location while bounding and scrubbing each cause", () => {
  const source: InvestigationDiagnosticSource = {
    kind: "git-revision",
    revision: "b".repeat(40),
    path: `${"long-directory/".repeat(60)}investigation-index.json`
  };
  const token = `ghp_${"x".repeat(36)}`;
  const diagnostic: InvestigationDiagnostic = {
    code: "investigation-report.history-check-unavailable",
    reason: "historical index invalid",
    recovery: "inspect the reported cause",
    source,
    target: "investigation collection",
    causes: Array.from({ length: 5 }, (_, index) => ({
      code: `state-index.cause-${index}`,
      detail: `${token}\n${"detail ".repeat(150)}`,
      stateId: "base"
    }))
  };
  const lines = renderInvestigationDiagnostic(diagnostic);
  const output = lines.join("\n");
  assert.ok(output.includes(`revision: ${source.revision}`));
  assert.ok(output.includes(`path: ${JSON.stringify(source.path)}`));
  assert.deepEqual(
    lines
      .filter((line) => line.trimStart().startsWith("cause:"))
      .map((line) => line.trimStart()),
    [
      'cause: [state-index.cause-0] "base"',
      'cause: [state-index.cause-1] "base"',
      'cause: [state-index.cause-2] "base"'
    ]
  );
  assert.doesNotMatch(output, /state-index\.cause-3|state-index\.cause-4/u);
  assert.match(output, /omittedCauses: 2/u);
  assert.doesNotMatch(output, new RegExp(token, "u"));
  const details = lines.filter((line) =>
    line.trimStart().startsWith("detail:")
  );
  assert.equal(details.length, 3);
  for (const detail of details) {
    assert.ok(detail.trimStart().slice("detail: ".length).length <= 500);
    assert.match(detail, /\[redacted\]/u);
  }
});
