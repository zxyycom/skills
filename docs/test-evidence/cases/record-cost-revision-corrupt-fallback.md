### Case RECORD-COST-CASE-002: 损坏对象按需失败

Tests:
- `test:2847de5eca2b142ac288a0252e6eb11e3e2e890158cca5f0b3494330f728f46e`

Tags:
- `record-cost`

Contract:
- 未消费的损坏对象不得使已消费路径失败。

Proves:
- 损坏后项触发回退，前项成功、后项报对应错误。
