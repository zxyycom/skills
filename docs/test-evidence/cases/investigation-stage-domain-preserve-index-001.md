### Case INVESTIGATION-STAGE-DOMAIN-PRESERVE-INDEX-001: stage --scope domain preserves staged index pending bytes and reports the preserved scope

Tests:
- `test:0b5d4f2a899fdc5ea3979c789f4b3669dce0ada6bef9eed5f17b05a6841772f0`

Tags:
- `investigation-report`

Contract:
- domain scope 原样保留已暂存索引字节并报告保留范围。

Proves:
- 先 index 后 domain 后 pending 索引字节与 index 结果一致；结果报告 preserved 与 caller-owned 索引路径。
