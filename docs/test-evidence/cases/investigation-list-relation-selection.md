### Case INVESTIGATION-LIST-RELATION-SELECTION-001: 列表关系选择复用依据并保持窗口边界

Tests:
- `test:c605a43130bc05b05585903ae3b261367cf61798962e17c68796bd4be964bfa3`

Tags:
- `investigation-report`

Contract:
- 关系条件在同一快照中选择命中 ID 与完整匹配边；type 与 target 必须匹配同一条边，关系筛选不改变全集 facets 或既有分页。

Proves:
- 无关系条件省略 filterRelations，type-only 只带匹配出边；type+target 排除不同边分别命中的报告，默认 both 等于显式 both，分页保留 total 和对应依据，空匹配仍保留全集 facets、limit 与 offset。
