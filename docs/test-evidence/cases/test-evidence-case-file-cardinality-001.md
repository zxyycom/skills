### Case TEST-EVIDENCE-CASE-FILE-CARDINALITY-001: 单文件只能保存一个完整 Case

Tests:
- `test:e111094bc27bf65ea450edddb7a89e28075fff24d63dda5fd52b0a9e7a23e806`

Tags:
- `test-evidence`

Contract:
- 每个 Case 文件只能有一个首行标题和一组完整有序的字段，不得附加第二个 Case。

Proves:
- 一个文件中的第二个 Case 标题作为不受支持内容被完整 Case 校验拒绝。
