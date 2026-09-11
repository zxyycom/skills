### Case DECISION-LIST-EMPTY-001: List 对无匹配 tag 或 alignment 返回空结果

Tests:
- `test:ca76852c7af908bbab6b1654dec8e9855cbb37046f9c9b174e27aa0fb42bf462`

Tags:
- `decision-records`

Contract:
- 不匹配的 tag 或 alignment 是成功的空查询，不得返回无关记录。

Proves:
- 两类选择器均输出 `none`。
