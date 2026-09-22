### Case INVESTIGATION-STAGE-MISSING-001: stage --scope index rejects IDs missing from the current collection

Tests:
- `test:52d1662554a777e0f625c3a124b9a92d6d20f4af8d6aa94ce4b99d7538ff7444`

Tags:
- `investigation-report`

Contract:
- 当前报告集合不存在的 Investigation ID 不能被选择性暂存。

Proves:
- 缺失 ID 返回错误。
