### Case INVESTIGATION-STAGE-OVERLAY-001: stage-index selects entries by Investigation ID without staging reports

Tests:
- `test:071716067c5cba93f2a0035ea5ec517e99f1e07dec5b1ec90de4335cb2c3645f`

Tags:
- `investigation-report`

Contract:
- `stage-index` 只按 Investigation ID 选择派生 index entry，不自动暂存报告 Markdown。

Proves:
- 真实 Git fixture 成功选择报告 ID；暂存区只含派生 index，不含报告 Markdown。
