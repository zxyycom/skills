### Case TEST-EVIDENCE-CORE-INDEX-001: Case 索引查询与标签不依赖实体快照

Tests:
- `test:f7c4dce8bcbf191958a208314365a709c8b4d8c23c72b05267da499522b01572`

Tags:
- `test-evidence`

Contract:
- 持久 Case 索引独立于实体快照；同步后 list 和 tags 只能消费 Case 索引。

Proves:
- 按 tag 查询返回预期 Case，tags 返回各 tag 的准确 Case 计数。
