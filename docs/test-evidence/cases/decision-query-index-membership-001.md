### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 查询读取持久快照且 Check 检测来源漂移

Tests:
- `test:c8597381b29574e907d1d9044bcafe3d62a282219aa7c6f3dbd9e6439acadbee`

Tags:
- `decision-records`

Contract:
- list/trace 读取持久索引快照，show 读取正文，严格 check 检测来源漂移。

Proves:
- 删除正文后 list/trace 仍从快照返回，show/check 失败。
