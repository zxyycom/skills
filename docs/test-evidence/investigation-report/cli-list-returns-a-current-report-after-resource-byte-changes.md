### Case INVESTIGATION-CLI-LIST-001: CLI list returns a current report after resource byte changes

Entry:

- `tools/investigation-report/tests/cli-generated.test.ts > CLI list returns a current report after resource byte changes`
- `bun test --test-name-pattern="^CLI list returns a current report after resource byte changes$" ./tools/investigation-report/tests/run.ts`

Contract:

- 资源字节变化不使报告 index 过期，分发 CLI `list` 继续可查询当前报告。

Proves:

- 在真实资源字节先后不同的 fixture 上，`list` 成功、stderr 为空且 stdout 返回报告。
