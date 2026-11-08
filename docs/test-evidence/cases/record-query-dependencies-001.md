### Case RECORD-QUERY-DEPENDENCIES-001: 两域发现按实际依赖验图

Tests:
- `test:fa7e50e3f4d84a397b36c36081b21b228b38456e9bb29ee46f8f03bd2ce5b1c5`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- 不使用关系的查询不要求完整关系图合法；关系筛选和 trace 需要有效关系图。

Proves:
- DR 与 IR 的真实 CLI 面对结构合法但成环的发布图，list、metadata search、show、content search 成功；关系筛选 list 和 trace 均失败。
