### Case INVESTIGATION-STAGE-DEPENDENCY-DRIFT-001: 阶段比较拒绝必要 owner 与共享资源字节漂移

Tests:
- `test:b5da5579801f8b91765ea1beb97b3da309bf7a0cf226ab3fbab9d41d62c0e819`

Tags:
- `investigation-report`

Contract:
- 局部依赖只进入验证范围；已取得的两个阶段中必要 owner 或共享资源字节不同，领域写计划比较必须拒绝。

Proves:
- 分别对必要 owner 正文和直接共享资源构造两份真实 FS 采集；漂移路径各读取两次，第二份采集包含改变后的字节。
- `verifyDomainWrites` 返回必要 owner 字节或表示漂移，现场新字节不被覆盖。
