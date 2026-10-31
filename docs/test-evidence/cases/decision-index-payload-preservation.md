### Case DR-INDEX-PAYLOAD-PRESERVATION-001: index保持未选部分暂存模式及删除

Tests:
- `test:f3f3c3dbea061d514ff52dc38062f3f4e310fb223346143e7f79d9ecafe13dd1`

Tags:
- `decision-records`

Contract:
- index只写索引投影，未选pending投影与文件表示、部分字节和staged删除保持。

Proves:
- 用独立Git读取核对未选partial正文、可执行mode及staged删除不变，所选更新而未选索引title沿用pending。
