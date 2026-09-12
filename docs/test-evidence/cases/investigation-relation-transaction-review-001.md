### Case INVESTIGATION-RELATION-TRANSACTION-REVIEW-001: set-relations 核对区分关系变化并按来源渲染

Tests:
- `test:57ee9935cf1851475156f3bd986226773f98b9a7625169229ac94aadb3acaab3`
- `test:ce9588f50ae79028ad3ac59b3fd1882a3ac5ef409ba3c26b0f0209a8ac38bce6`

Tags:
- `investigation-report`

Contract:
- 成功的 `set-relations` relationReview 完整区分 summary 增加、变更、移除、清空、未变化与多来源规范集合；CLI 逐边以 source、type、target 及摘要或缺省标记渲染 before、after 和变化。
- 无法准备事务的失败结果不携带成功 relationReview。

Proves:
- 逐次替换展示 summary 的 before/after，清空和多来源结果显示 source、action 与最终集合，重复写入标记 unchanged；空 replacements 的错误结果使 `relationReview` 为 undefined。
- CLI 分别展示 source-qualified summary 清除、清空移除与新增边，使用完整三段边格式和缺省摘要标记。
