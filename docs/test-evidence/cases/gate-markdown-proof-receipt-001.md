### Case GATE-MARKDOWN-PROOF-RECEIPT-001: Markdown 内容证明的成功证明

Tests:
- `test:f4d3132df44896da41eac9ce650310c87c5422ea9f27fa1920aeebba5f7c6a42`

Tags:
- `repository-tooling`

Contract:
- markdown-lint 必须持有自己的完整成功 receipt，不能借其它 Check 成功省略或在执行未通过时发布。

Proves:
- 只缺 lint receipt 时仅激活 lint；缺其 passed 结果拒绝发布，下一轮仍执行。
