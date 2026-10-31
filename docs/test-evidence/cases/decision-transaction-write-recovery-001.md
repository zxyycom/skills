### Case DECISION-TRANSACTION-WRITE-RECOVERY-001: 决策事务在写失败后恢复全部 Markdown 与索引

Tests:
- `test:42af1b4e578717fe95a415df22ca827ef639ce4533dead39849b23efd8199617`

Tags:
- `decision-records`

Contract:
- 多文件事务在正式索引发布前失败时，CAS 恢复已写 Markdown 并证明旧索引未变。

Proves:
- 在原子索引替换执行前注入 `EIO`，两个正文和索引均恢复，且事务保留受控失败详情。
- 事务结果声明 `rolled-back`，表明该 owner 已验证完整恢复。
