### Case INVESTIGATION-RELATION-FILTER-EVIDENCE-001: 关系筛选投影完整匹配边并按预算展示

Tests:
- `test:5f2b0ec8ab35626f8a98b93c1d0f0aca18af63ae06201fa0a9e021859001f7e9`
- `test:91c67475f7cc124d5affcb0205796b357c7153c94600d955289fafb1c12846f7`

Tags:
- `investigation-report`

Contract:
- 关系筛选证据按稳定目标顺序输出，CLI 预览遵守声明预算。

Proves:
- 乱序目标与多条关系返回准确排序/去重摘要，CLI 输出遵守每条预览预算；样本不区分 locale 与 UTF-16 排序实现。
