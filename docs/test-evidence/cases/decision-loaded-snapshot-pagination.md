### Case DECISION-LOADED-SNAPSHOT-PAGINATION-001: 发布快照查询跨越 reader 页上限而不丢失记录

Tests:
- `test:4441023749eaa25260d450f304813b7ab406ab8692b775c2ef808bcf4f99f232`

Tags:
- `decision-records`

Contract:
- list 与 trace 消费完整严格发布快照，保留时间及 ID 排序、筛选交集、全快照 facets、关系依据、分页和来源声明；内部 reader 页上限不限制领域全集。

Proves:
- 1,003 条纯发布索引在 offset 999 正确返回同时间的稳定 ID 页；时间端点、alignment、tags 与同边关系交集产生正确 total、完整 facets 和关系摘要，完整 ID 与唯一 name 的 trace 均保留前序、覆盖和 published-index 来源。
