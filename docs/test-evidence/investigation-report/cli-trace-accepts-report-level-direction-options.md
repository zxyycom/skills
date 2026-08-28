### Case INVESTIGATION-VALIDATION-WARNINGS-001: CLI trace accepts report-level direction options

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI trace accepts report-level direction options`
- `bun test --test-name-pattern="^CLI trace accepts report-level direction options$" ./tools/investigation-report/tests/run.ts`

Contract:

- 分发 CLI `trace` 支持报告级关系方向选项。

Proves:

- 带 `--direction successors` 的有效 trace 成功、stderr 为空，并在 stdout 返回后继报告和边。
