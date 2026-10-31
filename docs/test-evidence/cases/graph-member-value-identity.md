### Case GRAPH-MEMBER-IDENTITY-001: 按成员值和 kind 合并并保留直接目标并集

Tests:
- `test:1fa7956ce4029cbd59e2a8eb894a8bf2be016d1564e9a179bba950186473b639`

Tags:
- `relation-graph`

Contract:
- batch 单位身份按 kind 与规范化成员值，不按外部数组指针；合并的 direct 目标为成员内排序并集。

Proves:
- 不同数组顺序与重复成员仍合并同 kind 单位，切片外 direct 被过滤，不同 kind 单位分别保留并按既有次序排序。
