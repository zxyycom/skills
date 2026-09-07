### Case INVESTIGATION-STAGE-MISSING-001: stage-index rejects IDs missing from the current collection

Tests:
- `test:86798caa5bcd3f594d455364d106a7f396f783bf8df8a5a2443988584da8e36b`

Tags:
- `investigation-report`

Contract:
- 当前报告集合不存在的 Investigation ID 不能被选择性暂存。

Proves:
- 缺失 ID 返回错误。
