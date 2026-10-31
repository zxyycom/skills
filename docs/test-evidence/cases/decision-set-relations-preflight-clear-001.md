### Case DECISION-SET-RELATIONS-PREFLIGHT-CLEAR-001: set-relations 预检零写入并区分清空与未变化来源

Tests:
- `test:ea427788a572726711eb2b8acad87076ef0f3b531c8fc26bc45fcb2fff02384e`
- `test:ec94ef33096f6679939002158dfea18c20a41be4493b38538d79992812534bd3`

Tags:
- `decision-records`

Contract:
- `set-relations --preflight` 以完整参数只读预演；`--clear-relations` 提供显式空集合；同一请求中最终关系与原值相同的 source 报告 unchanged。

Proves:
- 预检返回 preflight review 且 Markdown 与索引字节保持不变。
- 清空来源写为空集合并更新索引；未变化来源的文件字节保持原值，review 区分 replace 与 unchanged。
