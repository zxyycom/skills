### Case NOVEL-CARDS-FUTURE-STATE-024: 预期与已发生边界

Tests:
- `test:3034a0d69947ca153debab8d7c542a0964448b324d22cab5375604fc1ac72fd4`

Tags:
- `novel-cards`

Contract:
- 预期状态不能覆盖已发生对象，已发生演进不能以预期剧情版本为依据。

Proves:
- 两种非法批量输入分别被拒绝；旧索引字节与当前对象版本保持不变。
