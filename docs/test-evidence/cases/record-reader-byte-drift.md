### Case RECORD-READER-REVISION-001: 同步强快照拒绝读取后的字节修订漂移

Tests:
- `test:10c83d0290d000efeb20330e8dc25c2976a913ad6e7736d14e267f3625141d36`

Tags:
- `record-operations`

Contract:
- 一次安全快照必须由同一个handle绑定读取前后修订，失败也必须关闭handle。

Proves:
- 真实读取后改写同一文件使采集拒绝，且finally关闭实际读取handle一次。
