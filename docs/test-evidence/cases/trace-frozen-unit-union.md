### Case GRAPH-TRACE-UNION-001: 冻结事件单位合并后仍接纳完整 trace 集合

Tests:
- `test:e12c661695d4873d797915404a0e143f4f44f28785b78d7ff0921b4c6027e08e`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 同 kind 和 recordIds 单位合并 traceIds 后按完整集合接纳；slice 外 traceId 不作为事件成员。

Proves:
- 先接纳一个冻结单位后，后续 union 的另一 trace 成员得到提升，outside 被排除。
