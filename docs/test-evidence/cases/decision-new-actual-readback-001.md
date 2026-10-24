### Case DECISION-NEW-ACTUAL-READBACK-001: 候选创建按实际字节验收结果

Tests:
- `test:9bffb1d8cfd8551aee402c5963f5e9703b636ee468e49db2ea954a8ef93d8fa0`

Tags:
- `decision-records`

Contract:
- 候选 create 的 writer 返回不是来源验收；提交后字节漂移必须非零并保留 mutation/sourcePath，不输出成功 readiness。

Proves:
- 原子创建后替换目标内容，CLI 报 partial-or-unknown 与已观察路径，不打印 scaffoldValid/bodyReady；后来内容和原正式索引保持。
