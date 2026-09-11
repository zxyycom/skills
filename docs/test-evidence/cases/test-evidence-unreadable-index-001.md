### Case TEST-EVIDENCE-UNREADABLE-INDEX-001: 不可读索引阻断 list 与 show 且不回退来源

Tests:
- `test:bf5d21340ee758a4dbe798f2c6b2377a9591c4983601f7df087674fd43d783a5`

Tags:
- `test-evidence`

Contract:
- 不可解码的持久索引必须阻断 list 与 show，且不得回退读取 Case 来源。

Proves:
- 将索引写为无效 UTF-8 后，list 返回零 Case、show 返回 null Case，二者均报告 `state-index.index-encoding-invalid`。
