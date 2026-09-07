### Case DECISION-LIST-EMPTY-001: List 对无匹配 tag 或 alignment 返回空结果

Tests:
- `test:4354e72b703e31a914e65cf478a0967f628f5ebaf5c8ca03e82a95b1719e8c78`

Tags:
- `decision-records`

Contract:
- 不匹配的 tag 或 alignment 是成功的空查询，不得返回无关记录。

Proves:
- 两类选择器均输出 `none`。
