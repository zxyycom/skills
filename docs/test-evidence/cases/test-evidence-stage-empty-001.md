### Case TEST-EVIDENCE-STAGE-EMPTY-001: 删除全部 Case 可形成合法空目标

Tests:
- `test:e7e84d2636a2ad9742ff612fbf3e712eb8ddd2956926c85f55fb408078c1f583`

Tags:
- `test-evidence`

Contract:
- 选中所有已删除 Case 的 revision 时，空 Case-only entries 可以形成合法暂存目标。

Proves:
- 删除两个 Case 并选中二者后，暂存成功且 pending 索引中的 entries 为 `{}`。
