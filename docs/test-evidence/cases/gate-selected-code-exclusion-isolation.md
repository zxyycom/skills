### Case GATE-SELECTED-CODE-EXCLUSION-ISOLATION-001: 单域负模式不吞掉其他域的显式包含

Tests:
- `test:6b98a44e40ba66d74e891756e4754b5641b490d4c9ac2059504ed2a6057ce621`

Tags:
- `repository-tooling`

Contract:
- file/function metrics 先独立应用各领域的正负模式，再合并结果；联合选组的顺序不改变所选代码。

Proves:
- 真实 file-text-search 单域选集包含搜索实现并排除 record-search-output；真实 record-search-output 单域仅包含输出实现。
- 两种选组顺序均经真实原生 options 和 collectProjectFiles 得到两份源码的并集；index-runtime 依赖与技能生成输出副本始终排除。
