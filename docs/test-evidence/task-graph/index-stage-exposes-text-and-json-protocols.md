### Case TASK-GRAPH-STAGE-PROTOCOL-001: Index stage 提供专用文本与显式 JSON 协议

Entry:
- `tools/task-graph/tests/staging.test.ts > index stage exposes stable text and explicit JSON protocols without native runtime`
- `bun test --test-name-pattern="^index stage exposes stable text and explicit JSON protocols without native runtime$" ./tools/task-graph/tests/run.ts`

Contract:
- 实际 `index stage` 默认使用稳定单行文本，显式全局 `--json` 序列化同一 raw result；Git pending staging 不加载工作区 task index mutation 的 native runtime。

Proves:
- 成功文本逐字段报告 state、revision、task-count、next-task-id 与 selected-task-ids，JSON route 返回同一结构化数据；目标等于 HEAD 时稳定报告 `unchanged`/`false`。
- 重复 task ID 的本地失败使用专用文本 renderer 和 `ARGUMENT_INVALID`，且不改变 pending。
