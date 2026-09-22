### Case INVESTIGATION-STAGE-CONFLICT-001: stage --scope index preserves strict current index definition requirements

Tests:
- `test:f6582316998cd40b348c5f65c7e5320caab2691534fa0062a6f327a8dcb4cff7`

Tags:
- `investigation-report`

Contract:
- 选择性暂存要求当前 index 定义完整合法。

Proves:
- 真实 Git fixture 中旧或错误 definition overlay 明确返回诊断，且 cached pending 保持不变。
