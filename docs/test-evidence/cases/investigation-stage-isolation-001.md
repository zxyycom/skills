### Case INVESTIGATION-STAGE-ISOLATION-001: stage-index keeps report Markdown outside selected index staging

Tests:
- `test:f7a5f9b4bf20a1461fab06a38f3df7d20c932677e6160566136f96486697799f`

Tags:
- `investigation-report`

Contract:
- `stage-index` 的暂存写入边界仅为派生 index，不包含报告 Markdown。

Proves:
- 真实 Git fixture 中暂存区只含 index；cached index 等于工作树 index，报告 Markdown 仅留在未暂存工作树差异中。
