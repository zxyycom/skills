### Case RECORD-READER-PARENTS-001: 同步读取拒绝父目录身份替换

Tests:
- `test:9a1449f03cbdd1848ff7e2de15a1bdef4111b8b39689ce2419a719f0a9c052d1`

Tags:
- `record-operations`

Contract:
- 正文和强快照都必须保留读取前后完整父链身份，叶inode相同不足以接纳。

Proves:
- 真实交换父目录并以硬链接保留叶身份后，两种同步读取合同均拒绝。
