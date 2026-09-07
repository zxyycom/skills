### Case DECISION-STATE-MEMORY-RELATION-SOURCE-001: 内存来源拒绝缺失的关系目标

Tests:
- `test:3f0429170abea4939112cc5d563783ff501721b96cfca9fa783e36cbd98a09e1`

Tags:
- `decision-records`

Contract:
- 内存快照只能以传入 source 集合解析关系，缺失 ID 目标不得由磁盘文件补足。

Proves:
- 移除归档目标 source 后构造快照，断言关系目标不存在。
