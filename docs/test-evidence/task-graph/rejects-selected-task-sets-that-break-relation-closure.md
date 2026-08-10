### Case TASK-GRAPH-STAGE-CLOSURE-001: 不闭合的选择集整批拒绝

Entry:
- `tools/task-graph/tests/staging.test.ts > rejects a selected task set that breaks relation closure without changing pending content`
- `bun test --test-name-pattern="^rejects a selected task set that breaks relation closure without changing pending content$" ./tools/task-graph/tests/run.ts`

Contract:
- 分段暂存不会自动扩大 task 选择集；混合目标必须重新通过完整关系与语义校验。

Proves:
- 只选择对称排斥关系的一端返回 `TOPOLOGY_INVALID`，诊断保留调用方的 task ID 集合。
- 失败后 pending 仍等于 HEAD，工作区候选及其完整对称关系保持不变。
