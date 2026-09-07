### Case TASK-GRAPH-STAGE-CLOSURE-001: 不闭合的选择集整批拒绝

Tests:
- `test:2e108988d55b03eb2aeb147584d8a981b2369f10291db88c095c7bb06b9a0d00`

Tags:
- `task-graph`

Contract:
- 分段暂存不会自动扩大 task 选择集；混合目标必须重新通过完整关系与语义校验。

Proves:
- 只选择对称排斥关系的一端返回 `TOPOLOGY_INVALID`，诊断保留调用方的 task ID 集合。
- 失败后 pending 仍等于 HEAD，工作区候选及其完整对称关系保持不变。
