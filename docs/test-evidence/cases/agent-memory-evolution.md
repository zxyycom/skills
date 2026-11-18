### Case AGENT-MEMORY-EVOLUTION-001: 演进后仍须满足组合有效性

Tests:
- `test:a3572018c8974a27b295b337fdd5c9e419ae26420ffe5b164388096551a14688`

Tags:
- `agent-memory`

Contract:
- 联合单元提交时，其当前构成链必须可用，即使同一事务也在退役前提。

Proves:
- 同一批写入若退役新组合间接采用的前提，整个批次失败；没有新命中且原构成链仍可用。
