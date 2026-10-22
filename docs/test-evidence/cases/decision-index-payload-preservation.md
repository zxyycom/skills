### Case DR-INDEX-PAYLOAD-PRESERVATION-001: index保持未选部分暂存模式及删除

Tests:
- `test:f1231064d1918cc52ed66472eb0c146f5d8322134f9ea280c99212613cbc1624`

Tags:
- `decision-records`

Contract:
- index只写索引投影，未选pending投影与文件表示、部分字节和staged删除保持。

Proves:
- 用独立Git读取核对未选partial正文、可执行mode及staged删除不变，所选更新而未选索引title沿用pending。
