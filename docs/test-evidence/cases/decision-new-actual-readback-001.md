### Case DECISION-NEW-ACTUAL-READBACK-001: 候选创建按实际字节验收结果

Tests:
- `test:77bed498540dc3712b2ab744fdda4b07e38b89a617db43b1a3d89f1e4082d0f1`

Tags:
- `decision-records`

Contract:
- 候选 create 的 writer 返回不是来源验收；提交后字节漂移必须非零并保留 mutation/sourcePath，不输出成功 readiness。

Proves:
- 原子创建后替换目标内容，CLI 报 partial-or-unknown 与已观察路径，不打印 scaffoldValid/bodyReady；后来内容和原正式索引保持。
