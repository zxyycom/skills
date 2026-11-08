### Case DECISION-LIST-PAGE-001: Decision list 返回全局 facets 与近期稳定窗口

Tests:
- `test:9e384b8c0a87b3e039b43a96a8b5b173bb1d056653e69f560eca9fc5aa497a96`

Tags:
- `decision-records`

Contract:
- Decision list 按 createdAt instant 倒序与 ID 升序 tie-break 排序，时间范围包含端点并在其后应用 limit/offset；分页不截断全局记录数 facet。

Proves:
- 真实原生 CLI 使用等价 UTC 和偏移时刻作为范围两端，以 limit 1、offset 1 返回同刻第二个 ID，匹配总数为 2、全局 recordCount 为 3。
