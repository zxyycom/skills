### Case CHANGE-PLAN-CLI-CHECK-001: Check CLI 保持文本与 JSON 退出契约
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI check preserves text and JSON exit contracts`
- `bun test --test-name-pattern="^CLI check preserves text and JSON exit contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- Check CLI 的文本和 JSON 模式必须表达相同结果与退出码。
Proves:
- 成功和失败计划在两种输出模式下具有一致状态。
