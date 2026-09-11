### Case INVESTIGATION-RELATION-TRANSACTION-IDEMPOTENCE-001: set-relations is idempotent and leaves unrelated report fields unchanged

Tests:
- `test:ca160229ceeeb4f3c33fade1c4d857785be9abdc16e231f981f197881f8ba6c2`

Tags:
- `investigation-report`

Contract:
- 同一最终关系重复写入返回 unchanged，且不改写无关报告字段。

Proves:
- 第二次调用不改变报告字节，title 仍保留。
