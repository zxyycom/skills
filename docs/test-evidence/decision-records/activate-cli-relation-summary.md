### Case DECISION-RELATION-SUMMARY-002: Activate binds a CLI summary to its complete relation set

Entry:
- `tools/decision-records/tests/lifecycle-relations.test.ts > activate binds a CLI relation summary after resolving its target selector`
- `bun test --test-name-pattern="^activate binds a CLI relation summary after resolving its target selector$" ./tools/decision-records/tests/run.ts`

Contract:
- `activate --relation-summary <target-selector=summary>` binds only to a target in the same complete relation replacement after ID-first selector resolution; the summary is trimmed and is shown by the index and trace.

Proves:
- A target selector resolves to the established Decision ID, retains content after the first `=`, and writes the canonical relation summary to the index.
- Trace displays the stored summary with the existing relation edge.
