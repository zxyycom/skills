### Case DECISION-LIFECYCLE-POST-MUTATION-SCAN-001: 生命周期写后索引检查失败不得伪报成功

Tests:
- `test:852026df8bbd5ded7b3004ed339790cfcf477d317ad28a68e767bf68120434b2`

Tags:
- `decision-records`

Contract:
- 普通局部维护发布索引后复核本次发布字节，复核失败沿既有恢复责任撤销写入，不打印提交成功。

Proves:
- 索引原子发布后注入该索引的读取故障，archive 返回 transaction-failed / rolled-back 且 stdout 为空。
