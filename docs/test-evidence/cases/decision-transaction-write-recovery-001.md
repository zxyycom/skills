### Case DECISION-TRANSACTION-WRITE-RECOVERY-001: 决策事务在写失败后恢复全部 Markdown 与索引

Tests:
- `test:ea888e9c75255ce6e4eba3251c9ce40a9518e0e732c7f67b392d3a42a893ad21`

Tags:
- `decision-records`

Contract:
- 多文件事务替换索引后失败时恢复全部受影响 Markdown 和索引。

Proves:
- 在原子索引替换已完成后注入 `EIO`，两个正文和索引均恢复，且事务保留受控失败详情。
- 事务结果声明 `rolled-back`，表明该 owner 已验证完整恢复。
