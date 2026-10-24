### Case RECORD-READER-REVISION-001: 同步强快照拒绝读取后的字节修订漂移

Tests:
- `test:220a5a5fdc7aa343bd376257a67d04b6bf7f2bcef6356b9be8b09db1528b1192`

Tags:
- `record-operations`

Contract:
- 一次安全快照必须由同一个handle绑定读取前后修订，失败也必须关闭handle。

Proves:
- 真实读取后改写同一文件使采集拒绝，且finally关闭实际读取handle一次。
