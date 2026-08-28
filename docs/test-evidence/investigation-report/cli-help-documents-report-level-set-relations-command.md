### Case INVESTIGATION-CLI-LIST-FRESHNESS-001: CLI help documents report-level set-relations command

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI help documents report-level set-relations command`
- `bun test --test-name-pattern="^CLI help documents report-level set-relations command$" ./tools/investigation-report/tests/run.ts`

Contract:
- CLI 帮助可成功展示当前报告级命令表面。

Proves:
- 顶层 `--help` 返回成功。
