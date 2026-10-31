### Case IR-TRACE-RENDER-001: 终端输出保留稳定邻接顺序与摘要

Tests:
- `test:39e4edfa1f85da5c37d021d2b132e0a5b9151ad1795f5a64d6c296168156a6fa`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 终端图只展开切片内边，反向来源按 UTF-16 source ID 排序，同来源关系顺序保留；context 只显示不参与深度遍历。

Proves:
- 完整文本独立期待保留同来源多条边顺序、摘要 JSON 转义、缺省占位、context 来源边，并省略 slice 外关系。
