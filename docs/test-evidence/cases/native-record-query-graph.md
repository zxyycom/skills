### Case NATIVE-RECORD-QUERY-GRAPH-001: 追踪事件预算和关系筛选

Tests:
- `test:19e6feaeb3a2bbd0b45dfe37e7a215dda6e42fc624fae2ca41f36b0a7fed63d0`
- `test:5f19f3e5e0c354682d047be1ab0c97da576c458d76451c9297067f207dc880f6`
- `test:f0286f573f8276c416a9ef97f2606fe1738d431507e4c7e6703652669f74b7e4`
- `test:fa14b21b854b174209d38e20ebaee91f25795f9c18004ddde6ebb58cb0437018`

Tags:
- `record-rust`

Contract:
- 关系筛选和追踪不得部分接受受预算约束的事件或丢失匹配证据。

Proves:
- 固定图验证同边筛选、去重、深度、事件预算和 UTF-16 顺序。
