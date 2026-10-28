### Case WRITE-CANONICAL-CASE-003: 写对象失败时收束活动进程

Tests:
- `test:93c70ed15b854c413d41b98c2247d8e428d55b5308ab8d15eff14a322fcdcfbb`

Tags:
- `write-canonical`

Contract:
- 首个可观察写入失败后停止派发，已启动写入结束后才恢复锁。

Proves:
- 真实 Git 和受控失败核对派发数量、锁及失败后的 pending。
