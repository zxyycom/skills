### Case INVESTIGATION-STAGE-DOMAIN-PRESERVE-INDEX-001: stage --scope domain preserves staged index pending bytes and reports the preserved scope

Tests:
- `test:c422b57e2f128c80e31a50194a86896ed2091884d977e3bb011f0d7d6d6c13a4`

Tags:
- `investigation-report`

Contract:
- domain scope 原样保留已暂存索引字节并报告保留范围。

Proves:
- 先 index 后 domain 后 pending 索引字节与 index 结果一致；结果报告 preserved 与 caller-owned 索引路径。
