### Case TEST-EVIDENCE-LEDGER-CLI-CHECK-001: Check CLI 输出机器报告并映射校验状态
Entry:
- `tools/test-evidence/tests/ledger-cli.test.ts > ledger CLI check emits machine reports and maps validation status to exits`
- `bun test --test-name-pattern="^ledger CLI check emits machine reports and maps validation status to exits$" ./tools/test-evidence/tests/run.ts`
Contract:
- `check --json` 必须始终输出完整报告，并以退出码区分阻断诊断与成功校验。
Proves:
- 索引缺失返回退出码 1，索引当前返回退出码 0 与无诊断 Schema v5 报告。
