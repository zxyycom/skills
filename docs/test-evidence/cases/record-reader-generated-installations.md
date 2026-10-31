### Case RECORD-READER-DISTRIBUTION-001: 两个skill生成分发包含可执行worker闭包

Tests:
- `test:1c0301cb5a41fdb436da05d3aabe20e54ccdb071ba9c19d26bdbb05b758eface`

Tags:
- `record-operations`

Contract:
- 两个skill的构建产物必须各自包含worker及全部本地源码依赖，不能依赖另一skill或仓库源码路径。

Proves:
- 分别复制两个skill生成scripts至隔离安装后，真实Node通过安装内reader及worker完成1000项强快照并正常退出。
