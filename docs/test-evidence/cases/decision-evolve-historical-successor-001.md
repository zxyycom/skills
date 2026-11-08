### Case DECISION-EVOLVE-HISTORICAL-SUCCESSOR-001: 已建立来源要求明确 alignment

Tests:
- `test:04a2b403b266a017aeccfea254943a7fcb7474d1fd49e61ec5e3ead988751ea3`
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`

Tags:
- `decision-records`

Contract:
- 已建立来源无论活动或归档都必须有明确 alignment；非法来源不能被当作有效索引状态。

Proves:
- 原生 frontmatter 解析测试覆盖两种 status 与两种合法 alignment，并逐状态拒绝 null 与缺失；独立真实 check/sync 节点验证 active 空 alignment 拒绝且持久索引不变。该组合不声称直接验证 archived evolve 的错误文本或零写。
