### Case CHANGE-PLAN-CLI-ARGS-001: CLI 帮助与参数错误稳定
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI help and argument errors use stable exit contracts`
- `bun test --test-name-pattern="^CLI help and argument errors use stable exit contracts$" ./tools/change-plan/tests/run.ts`
Contract:
- 帮助请求和参数错误必须使用稳定输出与退出码。
Proves:
- Help 成功返回，缺失或冲突参数以参数错误退出。
