### Case INVESTIGATION-ROOT-CONFINEMENT-001: validation reports malformed frontmatter fields in the selected report

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation reports malformed frontmatter fields in the selected report`
- `bun test --test-name-pattern="^validation reports malformed frontmatter fields in the selected report$" ./tools/investigation-report/tests/run.ts`

Contract:
- 局部验证必须定位所选报告中的 frontmatter 字段错误。

Proves:
- 替换必需字段后，所选报告产生错误。
