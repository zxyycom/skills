### Case TEST-EVIDENCE-LEDGER-CLI-ARGS-001: Ledger CLI 严格拒绝缺失重复与畸形参数
Entry:
- `tools/test-evidence/tests/ledger-cli.test.ts > ledger CLI rejects missing repeated malformed and excess arguments with usage exits`
- `bun test --test-name-pattern="^ledger CLI rejects missing repeated malformed and excess arguments with usage exits$" ./tools/test-evidence/tests/run.ts`
Contract:
- CLI 必须要求显式 root，并拒绝重复 options、越界分页、非法 Tag/Case ID、多余参数与未知命令。
Proves:
- 每类用法错误都不输出领域结果，以 stderr 说明问题并使用退出码 2。
