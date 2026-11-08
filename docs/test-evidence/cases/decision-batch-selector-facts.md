### Case DECISION-BATCH-SELECTOR-001: 批量定位保留完整 ID 优先与名字歧义

Tests:
- `test:31264316906f2dd22939b5f1f81b75fb4ad55c79f7ef3fe06d41dfcb134f5fbb`

Tags:
- `selector`

Contract:
- 完整日期 ID 精确选择，歧义 name 不猜测，缺失日期 ID 不回退 name。

Proves:
- 共同 selector 层对同名日期记录精确定位带 .MD 的 ID；name 返回歧义，不存在的完整日期 ID 返回 not found。
