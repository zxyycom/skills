### Case DECISION-SCAN-ACQUISITION-INODE-001: 首次采集中拒绝同字节inode替换

Tests:
- `test:0855dafad6ae658b9ee6a08890d0673d2d1dc67674ae0815e4f9660f85e140c5`

Tags:
- `decision-records`

Contract:
- 首次采集不是结束新鲜性证明，但每份来源和索引在自身读取期间仍须保持路径/handle身份与字节稳定。

Proves:
- 在来源或索引安全handle读取后、路径验收前替换相同bytes/mode但新inode，scan失败且不以相同正文伪成功。
