### Case TEST-EVIDENCE-STAGE-UNCHANGED-001: 无变化选择返回 Unchanged 且不制造 Pending

Tests:
- `test:b874f6e47971bf0e4a401f6f35a72cd180ad2c69e36af69bd3c5486345ad7a68`

Tags:
- `test-evidence`

Contract:
- 所选 Case 与 Git 基线一致时，暂存返回合法无变化结果且不产生 cached 变更。

Proves:
- 结果为 ok + unchanged，cached 文件名列表为空。
