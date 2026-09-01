### Case INVESTIGATION-CLI-CONTRACTS-001: CLI check succeeds on a current report collection

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI check succeeds on a current report collection`
- `bun test --test-name-pattern="^CLI check succeeds on a current report collection$" ./tools/investigation-report/tests/run.ts`

Contract:

- 直接调用的源码 CLI 入口 `check` 能成功验证当前完整报告集合。

Proves:

- 合法集合以退出码 0 成功、stderr 为空，并在 stdout 报告完整 index 计数。
