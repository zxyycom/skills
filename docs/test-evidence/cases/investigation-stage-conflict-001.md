### Case INVESTIGATION-STAGE-CONFLICT-001: stage-index preserves strict current index definition requirements

Tests:
- `test:a0df847940ecbd43f6e0e5b529a28044bcd93e81ad1d218842af4441e9bb10c2`

Tags:
- `investigation-report`

Contract:
- 选择性暂存要求当前 index 定义完整合法。

Proves:
- 真实 Git fixture 中旧或错误 definition overlay 明确返回诊断，且 cached pending 保持不变。
