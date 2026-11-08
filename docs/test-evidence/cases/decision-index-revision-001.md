### Case DECISION-INDEX-REVISION-001: 严格检查检测来源漂移

Tests:
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`

Tags:
- `decision-records`

Contract:
- 正式正文变化后严格 check 应发现已发布 revision 不再当前。

Proves:
- 真实 CLI 对当前索引和正文先成功；正文追加内容后 check 失败并报告 index-not-current。
