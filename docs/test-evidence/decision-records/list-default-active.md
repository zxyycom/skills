### Case DECISION-LIST-DEFAULT-001: List 默认仅返回活动记录

Entry:
- `tools/decision-records/tests/queries.test.ts > decision list defaults to active records without archived results`
- `bun test --test-name-pattern="^decision list defaults to active records without archived results$" ./tools/decision-records/tests/run.ts`

Contract:
- 未指定 `--status` 时，list 读取活动快照，不能混入 archived 记录。

Proves:
- 默认输出包含活动 ID 而不含归档 ID。
