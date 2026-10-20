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
- 关系 review 纯分类函数在 summary 增加、变更、移除和清空时保留 before/after；多来源按 ID 排序，对象副本但内容相同标记 unchanged。公开 API 对空 replacements 预检返回完整 source 组错误、changed=false 且 `relationReview` 为 undefined。
- 关系 review renderer 直接向 stdout writer 输出 source-qualified summary 清除、清空移除与新增边，使用完整三段边格式和缺省摘要标记，且不写 stderr；不经 CLI 或文件事务。
