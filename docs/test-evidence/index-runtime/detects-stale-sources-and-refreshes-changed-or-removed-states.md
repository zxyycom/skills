### Case INDEX-RUNTIME-FRESHNESS-001: 检测旧源并刷新变化或移除的状态
Entry:
- `tools/index-runtime/tests/materialization.test.ts > detects stale sources and refreshes changed or removed states`
- `bun test --test-name-pattern="^detects stale sources and refreshes changed or removed states$" ./tools/index-runtime/tests/run.ts`
Contract:
- 源修订变化必须使旧索引失效，写同步必须完整反映更新与删除。
Proves:
- 旧索引被检测后可重建，字段修改与状态移除均进入新索引。
