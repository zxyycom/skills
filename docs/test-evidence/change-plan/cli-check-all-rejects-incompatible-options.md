### Case CHANGE-PLAN-CLI-CHECK-ALL-OPTIONS-001: Check-all CLI 拒绝不兼容选项
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check-all rejects incompatible options`
- `bun test --test-name-pattern="^CLI check-all rejects incompatible options$" ./tools/change-plan/tests/run.ts`
Contract:
- `check-all` 只接受可选 change root 与 `--json`；生命周期和 stage 选择只属于 `list`。
Proves:
- 单独提供 `--archived`、`--all` 或 `--stage` 都退出 `2` 并说明这些选项只适用于 `list`；帮助文本列出 `check-all`。
