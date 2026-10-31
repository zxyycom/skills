### Case INVESTIGATION-LIST-RELATION-SELECTION-001: 列表关系选择复用依据并保持窗口边界

Tests:
- `test:6975459dd9bea65c3ca3aeb09f523ae172bdd52c1414de0e99e2ac59043e0378`

Tags:
- `investigation-report`

Contract:
- 关系条件在同一快照中选择命中 ID 与完整匹配边；type 与 target 必须匹配同一条边，关系筛选不改变全集 facets 或既有分页。

Proves:
- 无关系条件省略 filterRelations，type-only 只带匹配出边；type+target 排除不同边分别命中的报告，默认 both 等于显式 both，分页保留 total 和对应依据，空匹配仍保留全集 facets、limit 与 offset。
