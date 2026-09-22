### Case INVESTIGATION-STAGE-OVERLAY-001: stage --scope index selects entries by Investigation ID without staging reports

Tests:
- `test:e08e7b0c16b23f55f7167bad46be005da4f3af1e286a0587e23672d83a8a66ca`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 只按 Investigation ID 选择派生 index entry，不自动暂存报告 Markdown。

Proves:
- 真实 Git fixture 成功选择报告 ID；暂存区只含派生 index，不含报告 Markdown。
