### Case RECORD-READER-REPRESENTATION-001: 同步强快照拒绝权限和叶身份漂移

Tests:
- `test:dde769e05909397bb0c085ccc2dcff6df4046609b1ac468ae71680401650517e`

Tags:
- `record-operations`

Contract:
- 快照必须证明同一handle与当前位置的身份和表示未在读取期间变化。

Proves:
- 真实chmod或替换叶文件后，读取不能返回有效快照。
