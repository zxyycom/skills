### Case RECORD-READER-INSTALLATION-001: Node独立源码闭包使用本地worker

Tests:
- `test:f25d5787291aa1dd1a41468e572409368f7670e7032eb7f56116bc01523ceefc`

Tags:
- `record-operations`

Contract:
- 可分发读取层须能从本地源码闭包经Node原生TS worker执行，不依赖仓库源码路径。

Proves:
- 独立临时安装中的真实Node成功读取1000项完整文本快照且正常退出。
