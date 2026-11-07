### Case NATIVE-RECORD-TXN-PARENT-001: 事务父目录身份与缺失证明

Tests:
- `test:09c9a8b36f49c44dbfe4ea9f9fae286e9df7d639f304b6e5d9b1f1835cbfbac6`
- `test:5328f9d0b84892e588baa3f17ae678d73382cef5f808c07ec7b435937c4233d8`
- `test:b8ae000124cdd2428f32562273dee59fd4ed00459e2a5770a436fecd23356c67`
- `test:e1588d58cb477dbcc54939cdf133d9775eab9c8e057749293af8e2891a0bccfc`

Tags:
- `record-rust`

Contract:
- 写入和恢复须遵循受管路径与安全目录约束；安全的父目录替换本身不是冲突。

Proves:
- 私有目录验证缺失父目录和创建后替换的处理，以及 fresh 前安全当前父目录可被使用；不证明所有非合作父链竞态均被拒绝。
