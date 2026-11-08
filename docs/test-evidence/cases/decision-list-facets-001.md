### Case DECISION-LIST-FACETS-001: Decision list facets 对完整 snapshot 确定聚合

Tests:
- `test:115f0bae1f3930bdcd28e0b33bed4e9448eeb85d93c506539e0dee6de67c00b7`
- `test:8fc38b0078d1ddfea1f7f8b68c272611f888965e27c46498c028dd1fe1023fad`

Tags:
- `decision-records`

Contract:
- Decision list facets 从同一完整 entries snapshot 查询时聚合记录、status、alignment、每记录唯一 tag、UTC 月份和规范时间边界；空集合使用唯一空表示。

Proves:
- 两条不同生命周期与 alignment 的原生索引记录跨 UTC 月界；活动列表只匹配一条，但 facets 保留全集 recordCount、状态/对齐、排序 tags 及准确 UTC 月份和时间边界。
- 空集合返回零计数、空 tags/月及 null 时间边界；共享 facet 单元另验证单记录重复 tag 只计一次及非法时间失败。
