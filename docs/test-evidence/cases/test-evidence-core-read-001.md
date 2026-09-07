### Case TEST-EVIDENCE-CORE-READ-001: List 与 tags 只读索引且 show 只读所选 Case

Tests:
- `test:6561430cf18d436f9cedfe1b362e1b84526782e054d3ae22a61cef9020fc7914`

Tags:
- `test-evidence`

Contract:
- list 和 tags 只消费持久索引；show 只读取索引定位的单个 Case。

Proves:
- 删除无关 Case 后 show 仍读取目标 Case；移走 cases 目录后 list 和 tags 仍从索引返回快照结果。
