### Case INVESTIGATION-STAGE-OVERLAY-001: stage-index selects entries by Investigation ID without staging reports

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index selects entries by Investigation ID without staging reports`
- `bun test --test-name-pattern="^stage-index selects entries by Investigation ID without staging reports$" ./tools/investigation-report/tests/run.ts`

Contract:
- `stage-index` 只按 Investigation ID 选择派生 index entry，不自动暂存报告 Markdown。

Proves:
- 真实 Git fixture 成功选择报告 ID；暂存区只含派生 index，不含报告 Markdown。
