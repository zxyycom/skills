### Case NATIVE-RECORD-SOURCE-CAPTURE-001: 安全捕获选定源与受限文件系统操作

Tests:
- `test:005c9a5dad27e2cb13ee518f1cfec6b63d7217258ec84371570423e6eafc17c5`
- `test:0fcf8f94b000dce9754915fd6c5f2ec981e74f5880d72510213b8a0e4326ecca`
- `test:19a7bb27d3a497135d6f256217f363f7b759c93570d1fa918a44aaffd38175ad`
- `test:2b40ee77a5ac4832e4d3fe2951a043264b027f8028eacd303d247cdb5bac1669`
- `test:31c7f6a7fd9362dd7690f9d97042a4e2ad1a56fa5de47c01c757864832c37b8c`
- `test:41f035313fe90164323a6d9093281a1d55a4d0df308a3da8f1c6c0ca3ea25a72`
- `test:4ad78ac23109dfc0693c0de2366708005cc46780a53134f7145c57a4894f936f`
- `test:551e62768ea633ec3cef9d75153fd8ca0173eef73fda60f031d7c46445f963f5`
- `test:a7030eb474442817ec5a989b89d6ddc571d010655b66f8cfdf2826cd04ec086b`
- `test:b5be6344be5af3344746dad7fcf571d923350c34e3a4b6d250893a7d05487af2`
- `test:d621602b3124046a3749073ab48fca46db721a9b58a71c582626194b5cdba4ec`
- `test:ea626a8a003158c592dd348b8a3c6fbbd6ba26dcc21d3c28aff3951b21159f9a`

Tags:
- `record-rust`

Contract:
- 源读取和条件操作须限定工作区与选定成员；普通更新比较内容和权限，拒绝只读目标。

Proves:
- 私有目录核对路径、链接、UTF-8、预算、条件创建及删除；同内容替换、权限变化、写集外硬链接和临时物所有权按实际字节与状态观察。
