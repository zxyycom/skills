import { historicalInvestigationDiagnostic } from "../../src/records/validation/validation-history-diagnostics.ts";
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

test("historical diagnostic renders independent system evidence safely", () => {
  const source: InvestigationDiagnosticSource = {
    kind: "git-revision",
    revision: "b".repeat(40),
    path: "index"
  };
  const token = `ghp_${"x".repeat(36)}`;
  const locator = "/" + "long/".repeat(130) + "x\nY\rZ\u001b";
  const warning = renderInvestigationDiagnostic(
    historicalInvestigationDiagnostic(source, [
      {
        code: "operation-failed",
        detail: "failed",
        path: locator,
        versionControl: {
          causeCategory: "access-denied",
          operation: `read\n${token}`,
          target: locator,
          detail: `independent ${token}\r\u001b detail`
        },
        filesystem: {
          causeCategory: "access-denied",
          operation: "stat",
          target: locator,
          detail: "filesystem evidence"
        }
      }
    ])
  )
    .map((line) => line.trimStart())
    .join("; ");
  assert.ok(
    warning.includes(
      `versionControl.target: "${JSON.stringify(locator).slice(1, -1)}"`
    )
  );
  assert.ok(
    warning.includes(`path: "${JSON.stringify(locator).slice(1, -1)}"`)
  );
  assert.match(warning, /versionControl\.causeCategory: access-denied/u);
  assert.match(warning, /versionControl\.operation: read \[redacted\]/u);
  assert.match(
    warning,
    /versionControl\.detail: independent \[redacted\].*detail/u
  );
  assert.match(warning, /filesystem\.detail: filesystem evidence/u);
  assert.ok(!warning.includes(token));
  assert.ok(!warning.includes(String.fromCharCode(27)));
});

test("diagnostic locators escape controls without losing path identity", () => {
  const lines = renderInvestigationDiagnostic({
    code: "investigation-report.history-check-unavailable",
    reason: "invalid\u001b[31m\nforged",
    recovery: "inspect",
    source: {
      kind: "git-revision",
      path: "inv\nFORGED/index",
      revision: "abc"
    },
    target: "inv\nFORGED/index"
  });
  assert.match(lines[0]!, /inv\\nFORGED\/index/u);
  assert.ok(lines.some((line) => line.includes('path: "inv\\nFORGED/index"')));
  assert.ok(
    lines.every((line) =>
      Array.from(line).every((character) => {
        const code = character.codePointAt(0)!;
        return code >= 32 && (code < 127 || code > 159);
      })
    )
  );
});
