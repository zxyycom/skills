### Case INVESTIGATION-CURRENT-INDEX-VALIDATION-001: Current 加载保留完整领域校验

Tests:
- `test:aa3bfc7429a5c645e190731c106f77442abb99d9542dc7b27a9d45f0720f6a7a`

Tags:
- `investigation-report`

Contract:
- Current 加载成功必须同时满足 state、metadata 和集合级领域不变量。

Proves:
- 来源 revision 未变时，非法 formedAt、多余 metadata 和重复 sourcePath 分别被拒绝，完整结果与严格发布加载失败一致。
