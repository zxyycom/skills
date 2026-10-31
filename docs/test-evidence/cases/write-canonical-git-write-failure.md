### Case WRITE-CANONICAL-CASE-003: 写对象失败时收束活动进程

Tests:
- `test:a7f6f42e308b3377d6bc4b6f6cbfcf135a901ccf5e1f19c3edd15fd6b1d4c7c8`

Tags:
- `write-canonical`

Contract:
- 首个可观察写入失败后停止派发，已启动写入结束后才恢复锁。

Proves:
- 真实 Git 和受控失败核对派发数量、锁及失败后的 pending。
