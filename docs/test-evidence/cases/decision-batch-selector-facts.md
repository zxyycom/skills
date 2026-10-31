### Case DECISION-BATCH-SELECTOR-001: 批量定位保留完整 ID 优先与名字歧义

Tests:
- `test:ab50486a21910217bb7be9ce9c02fcd139dc82815565d4b35f6e6eb14e8dc0ef`

Tags:
- `selector`

Contract:
- 完整日期 ID 精确定位；名字歧义保留排序候选。

Proves:
- 真实文件来源同步索引且 scan 无错误后，resolver 对同名日期与 legacy 记录给出完整排序歧义；完整日期 ID 优先，日期 miss 不回退名字，末尾 .md 一次规范化。
