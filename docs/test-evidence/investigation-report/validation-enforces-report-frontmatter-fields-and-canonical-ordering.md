### Case INVESTIGATION-REPORT-FRONTMATTER-001: validation enforces report frontmatter fields and canonical ordering

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > validation enforces report frontmatter fields and canonical ordering`
- `bun test --test-name-pattern="^validation enforces report frontmatter fields and canonical ordering$" ./tools/investigation-report/tests/run.ts`

Contract:

- 每份报告使用固定顺序的规范 frontmatter；relations 空集必须使用字节 `[]`，必填标量不得含控制字符。

Proves:

- 独立字面 Markdown 的规范 frontmatter 通过；调换字段、`relations:` 空值或 `\r` 标量各产生领域诊断。
