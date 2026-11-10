### Case NATIVE-RECORD-SOURCE-CANDIDATES-001: 候选列表独立读取每源成员

Tests:
- `test:b077e78dcd0aa5c3abff7436e4792291e764b1d08128756045dc3190f63bd9ef`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 按 key 的 candidates 分别发现各来源的候选，同一完整 ID 在不同来源是独立结果。

Proves:
- 两源分别创建同 ID、不同正文的合法候选，真实 candidates 返回两个成功来源，每源恰有一份候选且正文与其来源相符。
