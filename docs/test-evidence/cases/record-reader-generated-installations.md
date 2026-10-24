### Case RECORD-READER-DISTRIBUTION-001: 两个skill生成分发包含可执行worker闭包

Tests:
- `test:0ab119f1fcd45f5de7d040811ec68d59818cd4344d3f44d6cd1351117fe02c3a`

Tags:
- `record-operations`

Contract:
- 两个skill的构建产物必须各自包含worker及全部本地源码依赖，不能依赖另一skill或仓库源码路径。

Proves:
- 分别复制两个skill生成scripts至隔离安装后，真实Node通过安装内reader及worker完成1000项强快照并正常退出。
