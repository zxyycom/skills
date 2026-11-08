### Case DECISION-LIFECYCLE-MOVE-001: 归档与重新激活保留身份并往返移动来源

Tests:
- `test:4fa76af79117b1b83c33c41bd8b88e55bf882b708ad8127c8a0eb0a35780688b`

Tags:
- `decision-records`

Contract:
- archive/reactivate 往返保持决策身份和 createdAt，并移动相应 sourcePath。

Proves:
- 真实 CLI 归档后正文和索引指向 archive；重新激活后恢复 root 路径、active 状态和原 createdAt。
