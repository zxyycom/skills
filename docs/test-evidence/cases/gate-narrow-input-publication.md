### Case GATE-NARROW-PUBLICATION-001: 局部输入仍覆盖 ignored 材料且保持全快照漂移保护

Tests:
- `test:1cf6a6d1a2b3d78d750d66998182ecc96562de7344646166c002f202b09a6ab2`

Tags:
- `repository-tooling`

Contract:
- 订阅收窄不缩减磁盘采集与发布事务；ignored 的实际输入仍被捕获，起止任意工作区漂移仍阻断证明。

Proves:
- ignored generated-file 测试文件删除、重建和重命名均使原语测试重跑，稳定时可复用；执行后新增局部消费者未读的 renderer 仍以 workspace-drift 拒绝发布。
