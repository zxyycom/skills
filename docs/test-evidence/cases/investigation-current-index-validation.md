### Case INVESTIGATION-CURRENT-INDEX-VALIDATION-001: Current 加载保留完整领域校验

Tests:
- `test:82bb4b2cf1ae5df2d7dd58a1526cefa9d6cace3f37af29362397a5340aa5b160`

Tags:
- `investigation-report`

Contract:
- Current 加载成功必须同时满足 state、metadata 和集合级领域不变量。

Proves:
- 来源 revision 未变时，非法 formedAt、多余 metadata 和重复 sourcePath 分别被拒绝，完整结果与严格发布加载失败一致。
