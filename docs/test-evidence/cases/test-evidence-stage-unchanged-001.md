### Case TEST-EVIDENCE-STAGE-UNCHANGED-001: 无变化选择返回 Unchanged 且不制造 Pending

Tests:
- `test:e7e84d2636a2ad9742ff612fbf3e712eb8ddd2956926c85f55fb408078c1f583`

Tags:
- `test-evidence`

Contract:
- 所选 Case 与 Git 基线一致时，暂存返回合法无变化结果且不产生 cached 变更。

Proves:
- 结果为 ok + unchanged，cached 文件名列表为空。
