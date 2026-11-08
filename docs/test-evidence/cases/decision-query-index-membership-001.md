### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 发布元数据查询与来源一致性检查分离

Tests:
- `test:3793ebbf9de41d2ef23dcbddb7638a31c75bf238b2e7ebe3a6880a42c531218b`
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`

Tags:
- `decision-records`

Contract:
- metadata search 查询发布索引；check 独立检测来源与发布投影不一致。

Proves:
- 真实 CLI metadata search 对无效当前正文仍返回发布项；另一个真实 CLI check 在正文变更后报告 index-not-current。
