### Case DECISION-BATCH-LOOKUP-001: 批量定位与准备的 ID 工作线性增长

Tests:
- `test:0461a49f7b2285cb80a69dabce58edc8578c52b5aeca046034efea21f7b532b5`

Tags:
- `performance`

Contract:
- 一次定位或 fresh 准备阶段建立 ID lookup，后续选项和关系边复用该阶段事实。

Proves:
- 真实 Markdown 在内存中解析的 N=20/200、S=1/5/20 稀疏圈下，resolution、archive 准备及 successor/predecessor 的 ID 读取次数遵守线性上界，并返回合法准备结果；不以文件或 Git 获取证明计数。
