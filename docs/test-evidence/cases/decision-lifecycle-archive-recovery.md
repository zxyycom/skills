### Case DECISION-LIFECYCLE-ARCHIVE-RECOVERY-001: 归档与再启用保留创建身份

Tests:
- `test:4fa76af79117b1b83c33c41bd8b88e55bf882b708ad8127c8a0eb0a35780688b`

Tags:
- `decision-records`

Contract:
- 归档与再启用保留创建身份，并由 reactivate 显式选择 alignment。

Proves:
- 真实 CLI 归档后索引保留 createdAt；指定 aligned 再启用后索引恢复 active 与原 createdAt。
