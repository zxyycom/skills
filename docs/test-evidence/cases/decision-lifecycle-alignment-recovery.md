### Case DECISION-LIFECYCLE-ALIGNMENT-RECOVERY-001: 对齐前必须显式恢复缺失索引

Tests:
- `test:b1a0a31edf7eb178425bbc9ffa798f92c8d188bfa69e02fb5cde2d99b2155b45`

Tags:
- `decision-records`

Contract:
- mark-aligned 依赖可信发布索引，缺失时不隐式重建。

Proves:
- 真实 CLI 在缺索引时拒绝且不写来源；显式 sync-index 后 mark-aligned 成功，索引为 aligned。
