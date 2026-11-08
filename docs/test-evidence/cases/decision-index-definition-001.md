### Case DECISION-INDEX-DEFINITION-001: 索引拒绝旧 definitionVersion

Tests:
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`
- `test:b69072057c2e0f6ace9f0bae5474346b58d6e40619d59209d26bb851a608f4b6`

Tags:
- `decision-records`

Contract:
- 当前索引 parser 与严格 check 都拒绝旧 definitionVersion。

Proves:
- 真实 CLI list 对 10 版 definition 返回 `invalid-index`；另一个包含合法正式来源和当前索引的 fixture 在 check 成功后只改 definitionVersion 为 10，check 退出 1 并报告 definition identity 不匹配。
