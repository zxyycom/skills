### Case DECISION-BATCH-SELECTOR-001: 批量定位保留完整 ID 优先与名字歧义

Tests:
- `test:a3eb896be3167c7bcd968a6149e8548f2f413c56b8e1438b45db1722bb5d7350`

Tags:
- `selector`

Contract:
- 完整日期 ID 精确定位；名字歧义保留排序候选。

Proves:
- 真实文件来源同步索引且 scan 无错误后，resolver 对同名日期与 legacy 记录给出完整排序歧义；完整日期 ID 优先，日期 miss 不回退名字，末尾 .md 一次规范化。
