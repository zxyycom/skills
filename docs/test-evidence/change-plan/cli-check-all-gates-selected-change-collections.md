### Case CHANGE-PLAN-CLI-CHECK-ALL-001: Check-all CLI 门禁所选 Change 集合
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check-all gates selected change collections`
- `bun test --test-name-pattern="^CLI check-all gates selected change collections$" ./tools/change-plan/tests/run.ts`
Contract:
- `check-all` 默认门禁 active Change，允许显式选择 archived 或全部集合，并让文本与 JSON 输出使用同一个聚合结果决定退出状态。
Proves:
- 成员失败时文本 stderr 展开逐项诊断，JSON stdout 保留计数、根路径和完整成员结果。
- JSON 中每个成员都公开 `distance` 字段；Archived-only 文本只输出一行集合摘要。
- Archived-only 成功退出 `0`，all 选择同时包含 active 与 archived 并在存在无效成员时退出 `1`。
