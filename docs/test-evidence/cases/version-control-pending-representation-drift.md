### Case VERSION-CONTROL-PENDING-REPRESENTATION-DRIFT-001: 拒绝仅表示变化的期望漂移

Tests:
- `test:12cc3be19df0e2d241708b72b4a97324200c466fb751adacb4327dda9308b9ea`

Tags:
- `version-control`

Contract:
- 锁内期望保护包含文件表示，不能把同路径、同字节的表示变化当作未改变。

Proves:
- 读取可执行或符号链接快照后，仅将模式改为普通文件即返回 pending-conflict，写入 hook 未执行，完整 index 字节保持冲突现场原值。
