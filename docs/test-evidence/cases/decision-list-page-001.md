### Case DECISION-LIST-PAGE-001: Decision list 返回全局 facets 与近期稳定窗口

Tests:
- `test:a1f3cc95adc89252222aaa4b1b1e55421bcf98e536e32e63d7e4fb6f5075d207`

Tags:
- `decision-records`

Contract:
- Decision list 从一次索引 snapshot 在筛选外形成只含 aligned、unaligned 的全局 facets，按 createdAt instant 倒序与 ID 升序 tie-break 排序，并在包含端点的时间范围后应用 limit/offset。

Proves:
- 同时刻记录按 ID 稳定选择，包含端点的等价时区时间被匹配，第二页返回预期记录，而 facets 仍统计完整 active/archived、aligned/unaligned 集合与 UTC 月份；其 JSON 投影不含 unknown 或 null。
