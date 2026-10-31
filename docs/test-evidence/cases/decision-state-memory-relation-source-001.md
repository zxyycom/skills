### Case DECISION-STATE-MEMORY-RELATION-SOURCE-001: 内存来源拒绝缺失的关系目标

Tests:
- `test:c983724d922eab4a81bfcfbdd4b1bda382c371f2afaa11706b7c095cbd8f45a8`

Tags:
- `decision-records`

Contract:
- 内存快照只能以传入 source 集合解析关系，缺失 ID 目标不得由磁盘文件补足。

Proves:
- 移除归档目标 source 后构造快照，断言关系目标不存在。
