### Case VERSION-CONTROL-CONFLICT-001: 索引含冲突时拒绝 pending 读取
Entry:
- `tools/shared/tests/version-control.test.ts > rejects pending reads while the index contains conflicts`
- `bun test --test-name-pattern="^rejects pending reads while the index contains conflicts$" ./tools/shared/tests/version-control.test.ts`
Contract:
- pending 内容无法唯一确定时必须显式失败。
Proves:
- 合并冲突索引返回 `operation-failed` 并要求先解决 pending 内容冲突。
