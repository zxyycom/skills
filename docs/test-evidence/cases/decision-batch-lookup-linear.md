### Case DECISION-BATCH-LOOKUP-001: 批量定位与准备的 ID 工作线性增长

Tests:
- `test:d546adc454443e392eb6ba7520d5a15ea4d37e3854b805d8f0b5a7f0e0a3c38d`

Tags:
- `performance`

Contract:
- 一次定位或 fresh 准备阶段建立 ID lookup，后续选项和关系边复用该阶段事实。

Proves:
- 完整 Markdown 稀疏圈 N=20/200、S=1/5/20 下，resolution、archive 准备及 successor/predecessor 的 ID 读取次数遵守线性上界，并返回合法准备结果。
