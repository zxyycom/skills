### Case INVESTIGATION-REPORT-FRONTMATTER-001: validation enforces report frontmatter fields and canonical ordering

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces report frontmatter fields and canonical ordering`
- `bun test --test-name-pattern="^validation enforces report frontmatter fields and canonical ordering$" ./tools/investigation-report/tests/run.ts`

Contract:
- 每份报告使用固定 frontmatter 字段及其规范顺序。

Proves:
- 规范报告解析成功，交换字段顺序产生 fixed-order 诊断。
