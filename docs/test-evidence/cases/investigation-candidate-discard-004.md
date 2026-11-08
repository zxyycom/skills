### Case INVESTIGATION-CANDIDATE-DISCARD-004: 正式删除不审计未选候选引用

Tests:
- `test:6eeb2843d20f2ca1d340f822753e6dcdfd7e88748e2ca03a73247abe94ccca45`

Tags:
- `investigation-report`

Contract:
- 正式 discard 的引用保护来自发布索引，未选候选内容非法不扩大删除事务。

Proves:
- 未选候选不可解析时，正式 owner 与资源删除成功，候选字节保留。
