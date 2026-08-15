### Case DECISION-LIST-ALL-001: List all 返回两种生命周期及完整时间

Entry:
- `tools/decision-records/tests/queries.test.ts > decision list status all includes both lifecycles and full timestamps`
- `bun test --test-name-pattern="^decision list status all includes both lifecycles and full timestamps$" ./tools/decision-records/tests/run.ts`

Contract:
- `--status all` 返回活动与归档记录；`--full-time` 保留完整 `createdAt` 时间戳。

Proves:
- 输出包含两个 ID 和两个带时区的 fixture 时间戳。
