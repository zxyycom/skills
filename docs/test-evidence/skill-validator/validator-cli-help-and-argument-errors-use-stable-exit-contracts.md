### Case SKILL-VALIDATOR-CLI-ARGS-001: Validator CLI 帮助与参数错误稳定
Entry:
- `tools/skill-validator/tests/run.ts > validator CLI help and argument errors use stable exit contracts`
- `bun test --test-name-pattern="^validator CLI help and argument errors use stable exit contracts$" ./tools/skill-validator/tests/run.ts`
Contract:
- Validator CLI 的帮助和参数数量错误必须使用稳定退出契约。
Proves:
- Help 成功输出用法，多余参数以参数错误退出。
