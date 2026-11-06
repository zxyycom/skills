### Case NATIVE-RECORD-TXN-PARENT-001: 事务父目录身份与缺失证明

Tests:
- `test:09c9a8b36f49c44dbfe4ea9f9fae286e9df7d639f304b6e5d9b1f1835cbfbac6`
- `test:60ff818c3623e15bcccdb7d6c16f08946c7742622ccf56b8d7e83f722524c54d`
- `test:b8ae000124cdd2428f32562273dee59fd4ed00459e2a5770a436fecd23356c67`
- `test:e1588d58cb477dbcc54939cdf133d9775eab9c8e057749293af8e2891a0bccfc`

Tags:
- `record-rust`

Contract:
- 写入与恢复前须重新核对父链，替换父目录不能获得原证明。

Proves:
- 私有目录中验证创建后的父链、写前替换及恢复时不写入新父目录。
