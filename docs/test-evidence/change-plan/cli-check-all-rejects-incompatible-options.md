### Case CHANGE-PLAN-CLI-CHECK-ALL-OPTIONS-001: Check-all CLI 拒绝不兼容选项
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check-all rejects incompatible options`
- `bun test --test-name-pattern="^CLI check-all rejects incompatible options$" ./tools/change-plan/tests/run.ts`
Contract:
- `check-all` 只接受一个集合选择，不接受 stage 过滤，并必须在帮助文本中公开合法调用方式。
Proves:
- 同时使用 `--archived` 与 `--all` 或提供 `--stage` 时退出 `2` 并返回对应参数诊断；帮助文本列出 `check-all`。
