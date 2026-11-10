### Case NATIVE-RECORD-MULTI-SOURCE-ISOLATION-001: 来源组路由与显式定位隔离

Tests:
- `test:ee8267e2511def0fbb91a6d01129c16541dd32c8cd854f282a2ce48290fbd078`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 显式 root 或 investigationsDir 选择单源入口，仅与来源组选项 key 互斥；业务命令仍验证所选工作区的统一配置。

Proves:
- root+key、show/new 的不适用 key 均退出 2 并返回 invalid-arguments；实际定位根的坏配置分别使显式 root 和目录调用返回 config-error，修复后返回对应单源记录；有效来源组存在时显式目录仍返回单源结果，show 按本地记录读取。
