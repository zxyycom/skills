### Case TEST-EVIDENCE-STAGE-EMPTY-001: 删除全部 Case 可形成合法空目标

Tests:
- `test:9c4492875034b982d07fcdfa406079bf641210800ef67fd567e86167d6f92f69`

Tags:
- `test-evidence`

Contract:
- 选中所有已删除 Case 的 revision 时，空 Case-only entries 可以形成合法暂存目标。

Proves:
- 删除两个 Case 并选中二者后，暂存成功且 pending 索引中的 entries 为 `{}`。
