### Case NATIVE-RECORD-INDEX-BOUNDARY-001: 索引 JSON 严格字符边界

Tests:
- `test:742214772af86f0a140071ba80c86ab9669e3edd102fc5a108582693ae501d4d`

Tags:
- `record-rust`

Contract:
- 源索引不得接受孤立 UTF-16 代理项，同时保留合法 emoji 与文本转义。

Proves:
- 有效与无效固定 JSON 输入区分拒绝边界。
