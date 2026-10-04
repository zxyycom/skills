### Case LIGHTWEIGHT-JUDGMENT-LOG-JOURNAL-RECOVERY-001: WAL 切换等待后继续

Tests:
- `test:49ef595cf16ada73f2cf198b9e7a820a94312a9c5a6e663d746164f38df04fe8`

Tags:
- `lightweight-judgment`

Contract:
- writer 只在初始化 WAL 切换的单个五秒预算内等待 BUSY，准备好日志库后才发送。

Proves:
- 在真实 schema COMMIT 后让另一连接持有写锁，定向放行 WAL 语句；释放锁后重试成功、确认 journal_mode=wal、仅发送一次并保存一条 succeeded 记录。
