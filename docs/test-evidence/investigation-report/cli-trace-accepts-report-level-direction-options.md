### Case INVESTIGATION-VALIDATION-WARNINGS-001: CLI trace accepts report-level direction options

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI trace accepts report-level direction options`
- `bun test --test-name-pattern="^CLI trace accepts report-level direction options$" ./tools/investigation-report/tests/run.ts`

Contract:
- CLI `trace` 支持报告级的关系方向选项。

Proves:
- 带 `--direction both` 的有效 trace 返回成功。
