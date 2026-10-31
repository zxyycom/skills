### Case INVESTIGATION-CANDIDATE-PARTIAL-FAILURES-001: 候选读取不审计未选正式 owner 正文

Tests:
- `test:171a4406d645353a4a0d418489f8806eaaf92947181a7238a0b8dda4e65b0e91`
- `test:26b5ff44001c2900d3878f95e4e349578dba152cb454ae25c1b4e5415ddf9ae5`

Tags:
- `investigation-report`

Contract:
- 候选依赖的正式 owner 声明来自合法索引，不隐式检查当前 owner 的可读性或未知位置重复身份。

Proves:
- 对正式 owner fs.open 注入 EACCES 不影响候选 ready；将 owner 移到两个未发布位置也不触发正文发现。
