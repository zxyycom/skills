### Case INVESTIGATION-RENAME-REPORT-TARGET-DRIFT-001: 回滚不删除外部改写的新报告路径

Tests:
- `test:a1ddb89293e4c87d6036ae13ec6dd4b8900aa627ca7f397fd8f6f1d84edadf7a`

Tags:
- `investigation-report`

Contract:
- rename 在写入报告前记录旧路径原始字节和权限、写入后记录本事务的新路径字节和权限。索引发布失败时，只有新路径仍完全等于本事务快照才可删除；外部内容漂移必须保留并返回 `partial-or-unknown`。

Proves:
- index writer 在报告移动后改写新路径并失败时，外部报告字节不被删除。
- 缺失的旧路径以 exclusive create 恢复，旧索引也恢复，但结果不会伪报完整 rollback。
