### Case CHANGE-PLAN-CLI-PLAN-COMMIT-001: Plan CLI 要求制品已提交到 HEAD
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI plan requires artifacts committed at HEAD`
- `bun test --test-name-pattern="^CLI plan requires artifacts committed at HEAD$" ./tools/change-plan/tests/run.ts`
Contract:
- Draft 进入 plan 前，计划制品必须已经提交并可由当前 HEAD 确认。
Proves:
- 尚未提交的完整 Draft 制品被拒绝，JSON 错误明确要求制品位于 HEAD。
