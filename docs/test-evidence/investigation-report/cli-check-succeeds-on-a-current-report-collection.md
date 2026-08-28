### Case INVESTIGATION-CLI-CONTRACTS-001: CLI check succeeds on a current report collection

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI check succeeds on a current report collection`
- `bun test --test-name-pattern="^CLI check succeeds on a current report collection$" ./tools/investigation-report/tests/run.ts`

Contract:
- 当前完整报告集合可由 CLI `check` 成功验证。

Proves:
- 合法集合执行 `check` 返回成功退出码。
