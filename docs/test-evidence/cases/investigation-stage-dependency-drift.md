### Case INVESTIGATION-STAGE-DEPENDENCY-DRIFT-001: 写前重读必要 owner 与共享资源

Tests:
- `test:2301750f1cab300ad5aad4f42eaea214ab96c5d9160b613b619282438bb52669`

Tags:
- `investigation-report`

Contract:
- 局部依赖只进入验证范围，但其身份、字节和表示漂移仍阻断写入。

Proves:
- 在准备读取必要 owner 正文或共享资源后分别改变其字节；写前复核确实各读第二次，返回 source-drift，pending 不变。
