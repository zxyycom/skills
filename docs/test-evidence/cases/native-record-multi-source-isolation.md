### Case NATIVE-RECORD-MULTI-SOURCE-ISOLATION-001: 来源组选项与旧入口隔离

Tests:
- `test:ee8267e2511def0fbb91a6d01129c16541dd32c8cd854f282a2ce48290fbd078`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 显式 root 或 investigationsDir 选择原单源入口，且与显式 key/config 互斥；其他命令不接受来源组选项，也不隐式读取该配置。

Proves:
- root+key、目录+config 及 show/new 的不适用选项均退出 2 并返回 invalid-arguments；坏默认配置下 root 或目录单独覆盖各返回对应单源记录，默认 show、help 与 version 仍成功。
