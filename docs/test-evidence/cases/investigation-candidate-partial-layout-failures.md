### Case INVESTIGATION-CANDIDATE-PARTIAL-FAILURES-001: 候选读取不审计未选正式 owner 正文

Tests:
- `test:01dabf5ba9ab25ca39544b6ecbed4fe61c83fd90e971fa65d205ad233eacd2b0`
- `test:1820afa4b68625f44ef566d628e915edab1f3f2e22a00cf6d33451c4d9b73af3`

Tags:
- `investigation-report`

Contract:
- 候选依赖的正式 owner 声明来自合法索引，不隐式检查当前 owner 的可读性或未知位置重复身份。

Proves:
- 对正式 owner fs.open 注入 EACCES 不影响候选 ready；将 owner 移到两个未发布位置也不触发正文发现。
