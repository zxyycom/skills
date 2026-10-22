### Case INVESTIGATION-STAGE-DEPENDENCY-DRIFT-001: 阶段比较拒绝必要 owner 与共享资源字节漂移

Tests:
- `test:b5da5579801f8b91765ea1beb97b3da309bf7a0cf226ab3fbab9d41d62c0e819`

Tags:
- `investigation-report`

Contract:
- 局部依赖只进入验证范围；两阶段中必要 owner 或共享资源字节改变，stage 必须在来源复核或共同阶段比较中拒绝，不发布 pending。

Proves:
- 分别在真实 domain stage 准备阶段读取必要 owner 正文和直接共享资源后改变字节；漂移路径各读取两次，独立复核看到改变后的字节。
- owner 正文指纹不符保留 source-read-failed 诊断，共享资源字节差异由共同协调器返回 source-drift；两者均报告 source-drift 状态，完整 pending 身份不变且现场新字节保留。
