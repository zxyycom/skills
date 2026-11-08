### Case DECISION-CANDIDATE-EMPTY-INDEX-001: 候选收集不依赖空已发布索引

Tests:
- `test:06ce3f83d2e8787e27fd38c77dfa9b3e5641685d9878b09c7e72a103076235a6`

Tags:
- `decision-records`

Contract:
- 仅有 candidate、正式索引为空时，候选列表与详情仍可读取候选。

Proves:
- 真实 CLI 在合法空正式索引下执行 candidates/show-candidate 均成功并返回候选 ID。
