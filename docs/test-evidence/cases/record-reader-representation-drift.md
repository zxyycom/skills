### Case RECORD-READER-REPRESENTATION-001: 同步强快照拒绝权限和叶身份漂移

Tests:
- `test:f8e2e50fed9b5afcf6fd53f19ce74ee55b7102abc107dc15a7c5ed90b01694db`

Tags:
- `record-operations`

Contract:
- 快照必须证明同一handle与当前位置的身份和表示未在读取期间变化。

Proves:
- 真实chmod或替换叶文件后，读取不能返回有效快照。
