### Case CHANGE-PLAN-CATALOG-SHOW-001: Show 返回生命周期状态
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog shows lifecycle status`
- `bun test --test-name-pattern="^catalog shows lifecycle status$" ./tools/change-plan/tests/run.ts`
Contract:
- `show` 必须按目录位置区分 active 与 archived Change，并为 active Change 返回可读取 artifacts 和检查结果。
Proves:
- Active Change 返回 `active`、有效检查和 proposal 内容；归档目录中的 Change 返回 `archived`。
