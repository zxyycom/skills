### Case INVESTIGATION-CANDIDATE-PUBLISH-003: 索引发布失败时恢复候选正文并保留资源

Tests:
- `test:c6f88350a235ac357e20bc2a15103db47cb14b017793968615356b753122204d`

Tags:
- `investigation-report`

Contract:
- publish 不移动或改写 candidate resource；索引提交点前写入失败必须恢复 candidate，资源字节本身不构成 publish 漂移。

Proves:
- 索引写入故障实际命中后返回 rolled-back，候选正文恢复且 owner resource 的完整字节保留。
