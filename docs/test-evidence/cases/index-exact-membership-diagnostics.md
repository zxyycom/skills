### Case INDEX-EXACT-DIAGNOSTICS-001: 精确匹配保留非法标量诊断

Tests:
- `test:6f6edbb001f40bab38fec26bcf9080da4b1fd2216a6c6a95626deaef41c30c04`

Tags:
- `performance`
- `semantic-fidelity`

Contract:
- 查询边界拒绝空 requested 数组、null、非有限数字；保留 id 只接受字符串。

Proves:
- 非法值返回 query-invalid，布尔 id 返回 query-key-value-invalid，而不是成功空结果。
