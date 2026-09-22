### Case DECISION-SET-RELATIONS-PREFLIGHT-CLEAR-001: set-relations 预检零写入并区分清空与未变化来源

Tests:
- `test:5579bff71ff6b8d51d167448e7932dbdb48c1f2989dc736d13355276ad1cb8d0`
- `test:dc60b4f1fb5d7400c7d3e2827e76c506c49cdf13fd95c4854642588fe6137b15`

Tags:
- `decision-records`

Contract:
- `set-relations --preflight` 以完整参数只读预演；`--clear-relations` 提供显式空集合；同一请求中最终关系与原值相同的 source 报告 unchanged。

Proves:
- 预检返回 preflight review 且 Markdown 与索引字节保持不变。
- 清空来源写为空集合并更新索引；未变化来源的文件字节保持原值，review 区分 replace 与 unchanged。
