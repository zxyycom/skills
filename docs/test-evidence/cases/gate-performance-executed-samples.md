### Case GATE-PERFORMANCE-EXECUTED-SAMPLES-001: 原生未执行值不稀释实际测量

Tests:
- `test:de669802e4fa514f09e8a4a9a27c8836076aa0344fdb6f48371dca96f866309c`

Tags:
- `performance`
- `repository-tooling`

Contract:
- 原生 null 表示未执行，不能作为零耗时纳入统计；实际测量的零是合法样本。

Proves:
- 多个 null 不稀释唯一慢样本，其均值与 P90 仍触发失败；夹在 null 之间的真实零保留一个样本并通过零墙钟预算判断。
