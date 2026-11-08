### Case INVESTIGATION-RELATION-TRANSACTION-PREFLIGHT-001: set-relations 预检与重复执行

Tests:
- `test:21d1f64cb6816931b2e974d1f3ed6444e046debaf0e820f9790141bddc78cfd6`

Tags:
- `investigation-report`

Contract:
- 关系预检只准备写入计划，不写入所选正文；正式执行后重复相同关系为 unchanged，关系与摘要目标应独立解析后绑定。

Proves:
- 本地 fixture 的预检返回两项计划写入且正文保持原字节；错误日期的 summary selector 在预检失败且索引不变；以关系名称和摘要完整 ID 指向同一目标时，正式执行后 Markdown 与索引均保存 trim 后摘要，重复执行 changed 和 committed 均为 false。
