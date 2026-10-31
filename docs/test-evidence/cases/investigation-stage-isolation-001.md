### Case INVESTIGATION-STAGE-ISOLATION-001: stage --scope index keeps report Markdown outside selected index staging

Tests:
- `test:f53961e50995a3fca9515c10e81750751d4045072c8ef0784ef0352ef7c70afc`

Tags:
- `investigation-report`

Contract:
- `stage --scope index` 的暂存写入边界仅为派生 index，不包含报告 Markdown。

Proves:
- 真实 Git fixture 成功选择指定报告 ID，返回 changed=true；暂存区只含 index，cached index 等于工作树 index，报告 Markdown 无 cached 差异且仍留在未暂存工作树差异中。
