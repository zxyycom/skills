### Case NATIVE-RECORD-SOURCE-CAPTURE-001: 安全捕获选定源与受限文件系统操作

Tests:
- `test:005c9a5dad27e2cb13ee518f1cfec6b63d7217258ec84371570423e6eafc17c5`
- `test:19a7bb27d3a497135d6f256217f363f7b759c93570d1fa918a44aaffd38175ad`
- `test:2b40ee77a5ac4832e4d3fe2951a043264b027f8028eacd303d247cdb5bac1669`
- `test:31c7f6a7fd9362dd7690f9d97042a4e2ad1a56fa5de47c01c757864832c37b8c`
- `test:4ad78ac23109dfc0693c0de2366708005cc46780a53134f7145c57a4894f936f`
- `test:a7030eb474442817ec5a989b89d6ddc571d010655b66f8cfdf2826cd04ec086b`
- `test:b5be6344be5af3344746dad7fcf571d923350c34e3a4b6d250893a7d05487af2`
- `test:d621602b3124046a3749073ab48fca46db721a9b58a71c582626194b5cdba4ec`
- `test:ea626a8a003158c592dd348b8a3c6fbbd6ba26dcc21d3c28aff3951b21159f9a`

Tags:
- `record-rust`

Contract:
- 源读取和条件操作必须限定在工作区与所选成员，拒绝逃逸、竞争者和未经确认的替换。

Proves:
- 私有原生目录中检查路径、符号链接、严格 UTF-8、读取预算、条件创建及删除的实际结果。
