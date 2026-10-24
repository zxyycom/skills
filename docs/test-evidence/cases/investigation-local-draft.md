### Case INVESTIGATION-LOCAL-DRAFT-001: 无索引起草与候选读取仅发现无关正式身份

Tests:
- `test:cc4c59d4e4fc5e3d68808187a6e0e4304b9da13436f769bf34a0465a98767e60`

Tags:
- `investigation-report`

Contract:
- new 与 show-candidate 在真正缺少发布索引时可安全读取无关正式来源以发现 header 身份，但不验证其正文或宣布正式集合健康。

Proves:
- 无索引且无关正式来源保留合法 header、正文损坏时，起草成功并返回 scaffoldValid=true、bodyReady=false，show-candidate 也成功；new 的准备、独立 fresh、写后身份验收及 show-candidate 各调用一次 fs.open，合计四次，该计数反映身份发现所需打开，不表示验收正式正文。
