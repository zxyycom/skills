### Case INVESTIGATION-RELATION-TRANSACTION-REVIEW-001: set-relations 核对区分关系变化并按来源渲染

Tests:
- `test:058886be28dbb495f3f80fb4ff94bfa81c528affb48a7b3f0dc5968152bae043`
- `test:4edef2d704068749c786d2a6c39e5be5a3a73c2844b990db536877b7b4d75525`

Tags:
- `investigation-report`

Contract:
- 成功的 `set-relations` relationReview 完整区分 summary 增加、变更、移除、清空、未变化与多来源规范集合；CLI 逐边以 source、type、target 及摘要或缺省标记渲染 before、after 和变化。
- 无法准备事务的失败结果不携带成功 relationReview。

Proves:
- 关系 review 纯分类函数在 summary 增加、变更、移除和清空时保留 before/after；多来源按 ID 排序，对象副本但内容相同标记 unchanged。公开 API 对空 replacements 预检返回完整 source 组错误、changed=false 且 `relationReview` 为 undefined。
- 关系 review renderer 直接向 stdout writer 输出 source-qualified summary 清除、清空移除与新增边，使用完整三段边格式和缺省摘要标记，且不写 stderr；不经 CLI 或文件事务。
