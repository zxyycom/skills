### Case TASK-GRAPH-STAGE-CLOSURE-001: 不闭合的选择集整批拒绝

Tests:
- `test:d6a2b4d02950427dfd192f9999fb24b078f9567d55e15897a9840b81371bfa4b`

Tags:
- `task-graph`

Contract:
- 分段暂存不会自动扩大 task 选择集；混合目标必须重新通过完整关系与语义校验。

Proves:
- 只选择对称排斥关系的一端返回 `TOPOLOGY_INVALID`，诊断保留调用方的 task ID 集合。
- 失败后 pending 仍等于 HEAD，工作区候选及其完整对称关系保持不变。
