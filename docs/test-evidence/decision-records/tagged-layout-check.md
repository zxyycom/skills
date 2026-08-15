### Case DECISION-TAGGED-LAYOUT-CHECK-001: 标签化根目录与归档记录的严格 Check

Entry:
- `tools/decision-records/tests/queries.test.ts > decision check validates tagged root and archive records`
- `bun test --test-name-pattern="^decision check validates tagged root and archive records$" ./tools/decision-records/tests/run.ts`

Contract:
- 严格 check 接受当前标签化 root/archive fixture，并统计 established 生命周期。

Proves:
- API 验证无错误，计数为两条决策、一 active、一 archived。
