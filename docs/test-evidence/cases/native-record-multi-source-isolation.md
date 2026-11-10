### Case NATIVE-RECORD-MULTI-SOURCE-ISOLATION-001: 来源组路由与显式定位隔离

Tests:
- `test:ee8267e2511def0fbb91a6d01129c16541dd32c8cd854f282a2ce48290fbd078`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 显式 root 或 investigationsDir 选择单源入口，仅与来源组选项 key 互斥；业务命令仍验证所选工作区的统一配置。

Proves:
- root 与 key 同用退出 2 并返回 invalid-arguments；实际定位根的坏配置分别使显式 root 和目录调用返回 config-error，修复后返回对应单源记录；显式定位的 list 和 show 保留直接单源结果形状。
