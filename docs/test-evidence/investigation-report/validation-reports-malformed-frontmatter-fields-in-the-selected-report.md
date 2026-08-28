### Case INVESTIGATION-ROOT-CONFINEMENT-001: validation reports malformed frontmatter fields in the selected report

Entry:

- `tools/investigation-report/tests/parsing-directory.test.ts > validation reports malformed frontmatter fields in the selected report`
- `bun test --test-name-pattern="^validation reports malformed frontmatter fields in the selected report$" ./tools/investigation-report/tests/run.ts`

Contract:

- scoped validation 定位所选报告中的 frontmatter 标量错误。

Proves:

- 字面 `\r` 标量使所选报告返回必填标量的领域诊断。
