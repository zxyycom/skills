### Case INVESTIGATION-RELATION-TRANSACTION-IDEMPOTENCE-001: set-relations is idempotent and leaves unrelated report fields unchanged

Tests:
- `test:7e6c8d403b1c8a74907f7ac3226906ebefb8392c8be2155be66d8727daf74f8f`

Tags:
- `investigation-report`

Contract:
- 同一最终关系重复写入返回 unchanged，且不改写无关报告字段。

Proves:
- 第二次调用不改变报告字节，title 仍保留。
