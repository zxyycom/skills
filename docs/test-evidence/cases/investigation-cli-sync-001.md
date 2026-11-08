### Case INVESTIGATION-CLI-SYNC-001: 全量同步预检与损坏索引重建

Tests:
- `test:fed4491bac9a037ab05fa2c031fc29254b6127153d2342da02331fa7a2e69203`

Tags:
- `investigation-report`

Contract:
- 全量调查同步可从合法来源重建损坏的派生索引；预检不发布。

Proves:
- 私有文件 fixture 以 broken 索引启动，预检返回 previewed 且索引原字节不变；正式同步成功写入并提交索引。
