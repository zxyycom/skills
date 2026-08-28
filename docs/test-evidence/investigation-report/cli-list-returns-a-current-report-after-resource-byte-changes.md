### Case INVESTIGATION-CLI-LIST-001: CLI list returns a current report after resource byte changes

Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > CLI list returns a current report after resource byte changes`
- `bun test --test-name-pattern="^CLI list returns a current report after resource byte changes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源字节变化不使报告索引过期，CLI `list` 继续可查询当前报告。

Proves:
- 资源字节变化后 `list` 返回成功。
