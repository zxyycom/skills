### Case DECISION-BATCH-SELECTOR-001: 批量定位保留完整 ID、名字歧义和重复首条事实

Tests:
- `test:495ee0657c2c51a94448e1b1ca31cf01a525fe175702371617baa6e4445a9660`

Tags:
- `selector`

Contract:
- 完整日期 ID 精确定位；名字歧义保留排序候选，重复 ID 不覆盖首条来源。

Proves:
- 同名日期与 legacy 记录给出完整排序歧义；日期 miss 不回退名字，末尾 .md 一次规范化；首条 candidate 不被后条 established 取代。
