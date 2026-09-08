### Case DECISION-LIST-PAGE-001: Decision list 返回全局 facets 与近期稳定窗口

Tests:
- `test:81bf18aef7b14e98fc6cb734bf74a16e1487c20933b066e4735cff2323fb5745`

Tags:
- `decision-records`

Contract:
- Decision list 从一次索引 snapshot 在筛选外形成全局 facets，按 createdAt instant 倒序与 ID 升序 tie-break 排序，并在包含端点的时间范围后应用 limit/offset。

Proves:
- 同时刻记录按 ID 稳定选择，包含端点的等价时区时间被匹配，第二页返回预期记录，而 facets 仍统计完整 active/archived 集合与 UTC 月份。
