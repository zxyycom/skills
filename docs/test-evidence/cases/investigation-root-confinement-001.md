### Case INVESTIGATION-ROOT-CONFINEMENT-001: validation reports malformed frontmatter fields in the selected report

Tests:
- `test:a1063c06bde7962c918d656099f5a5f9c224d5dd1b1c2762f29cab9f6786359b`

Tags:
- `investigation-report`

Contract:
- scoped validation 定位所选报告中的 frontmatter 标量错误。

Proves:
- 字面 `\r` 标量使所选报告返回必填标量的领域诊断。
