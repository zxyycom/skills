### Case DECISION-REALLOCATION-MEMBERS-001: 合法稀疏重划完整直接遍历

Tests:
- `test:388620bc52856c56b4c8d70672af708253ca0207e6db5b00896feadb77378d8c`

Tags:
- `decision-records`

Contract:
- 重划完整成员原子接纳，不同 direct 单位仍晋升实际可达成员。

Proves:
- 真实 Markdown 在内存中解析的 d=10/100/300 稀疏圈通过领域及策略 shape/closure 检查；完整 trace 与全部 2d 成员集合精确一致、无 context 且 coverage 完整，不依赖落盘或 Git。
