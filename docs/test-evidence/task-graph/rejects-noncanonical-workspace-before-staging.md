### Case TASK-GRAPH-STAGE-CANONICAL-001: 非规范工作区索引在写 pending 前被拒绝

Entry:
- `tools/task-graph/tests/staging.test.ts > rejects a noncanonical workspace index before changing pending content`
- `bun test --test-name-pattern="^rejects a noncanonical workspace index before changing pending content$" ./tools/task-graph/tests/run.ts`

Contract:
- 分段暂存的 HEAD 基线、工作区候选与最终目标都必须是完整、有效且 canonical 的 task index。

Proves:
- 结构有效但缺少规范缩进与尾换行的工作区候选返回 `INDEX_INVALID`，诊断明确来源为 workspace。
- 校验失败发生在版本管理写入前，pending 相对 HEAD 没有变化。
