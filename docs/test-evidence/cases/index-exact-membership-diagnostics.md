### Case INDEX-EXACT-DIAGNOSTICS-001: 精确匹配保留非法标量诊断

Tests:
- `test:c8a7758097cf4348bbb2082d6a079518ee7c63f2a9026faa6034dcbe2933ac00`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 查询边界拒绝空 requested 数组、null、非有限数字；保留 id 只接受字符串。

Proves:
- 非法值返回 query-invalid，布尔 id 返回 query-key-value-invalid，而不是成功空结果。
