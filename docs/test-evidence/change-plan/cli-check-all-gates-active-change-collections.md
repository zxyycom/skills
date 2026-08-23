### Case CHANGE-PLAN-CLI-CHECK-ALL-001: Check-all CLI 门禁 Active Change 集合
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check-all gates active change collections`
- `bun test --test-name-pattern="^CLI check-all gates active change collections$" ./tools/change-plan/tests/run.ts`
Contract:
- `check-all` 固定门禁 active Change，并让文本与 JSON 输出使用同一个聚合结果决定退出状态。
Proves:
- 成员失败时文本 stderr 展开逐项诊断，JSON stdout 保留计数、根路径和完整 active 成员结果。
- JSON 中每个成员都公开 `distance` 并具有 `status: active`，archive 中的历史成员不进入结果。
