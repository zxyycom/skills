### Case TASK-GRAPH-STAGE-CLOSURE-001: 不闭合的选择集整批拒绝

Tests:
- `test:5991f623714f8f015ebabb371205f4a41ddd3e80fb191c846ad76bf6cc80fa28`

Tags:
- `task-graph`

Contract:
- 分段暂存不会自动扩大 task 选择集；混合目标必须重新通过完整关系与语义校验。

Proves:
- 只选择对称排斥关系的一端返回 `TOPOLOGY_INVALID`，诊断保留调用方的 task ID 集合。
- 失败后 pending 仍等于 HEAD，工作区候选及其完整对称关系保持不变。
