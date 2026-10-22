### Case DECISION-REALLOCATION-MEMBERS-001: 合法稀疏重划完整直接遍历

Tests:
- `test:4443b361845e930a4e27234afe65aebf4e7809e6bce7257579db27c65d94a2f5`

Tags:
- `decision-records`

Contract:
- 重划完整成员原子接纳，不同 direct 单位仍晋升实际可达成员。

Proves:
- 真实 Markdown 在内存中解析的 d=10/100/300 稀疏圈通过领域及策略 shape/closure 检查；完整 trace 与全部 2d 成员集合精确一致、无 context 且 coverage 完整，不依赖落盘或 Git。
