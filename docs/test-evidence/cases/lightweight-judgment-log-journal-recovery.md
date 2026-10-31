### Case LIGHTWEIGHT-JUDGMENT-LOG-JOURNAL-RECOVERY-001: WAL 切换等待后继续

Tests:
- `test:f9441ae9229f128c49b202d090ea3a3bdd2555ca352eadbc31b943c4d7db4a68`

Tags:
- `lightweight-judgment`

Contract:
- writer 只在初始化 WAL 切换的单个五秒预算内等待 BUSY，准备好日志库后才发送。

Proves:
- 在真实 schema COMMIT 后让另一连接持有写锁，定向放行 WAL 语句；释放锁后重试成功、确认 journal_mode=wal、仅发送一次并保存一条 succeeded 记录。
