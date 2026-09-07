### Case TEST-EVIDENCE-STAGE-UNCHANGED-001: 无变化选择返回 Unchanged 且不制造 Pending

Tests:
- `test:9c4492875034b982d07fcdfa406079bf641210800ef67fd567e86167d6f92f69`

Tags:
- `test-evidence`

Contract:
- 所选 Case 与 Git 基线一致时，暂存返回合法无变化结果且不产生 cached 变更。

Proves:
- 结果为 ok + unchanged，cached 文件名列表为空。
