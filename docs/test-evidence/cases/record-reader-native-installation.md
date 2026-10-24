### Case RECORD-READER-INSTALLATION-001: Node独立源码闭包使用本地worker

Tests:
- `test:f16af0ed3c061f868a38eb111f47ec131aaec21978ffe2f2586adae137a42026`

Tags:
- `record-operations`

Contract:
- 可分发读取层须能从本地源码闭包经Node原生TS worker执行，不依赖仓库源码路径。

Proves:
- 独立临时安装中的真实Node成功读取1000项完整文本快照且正常退出。
