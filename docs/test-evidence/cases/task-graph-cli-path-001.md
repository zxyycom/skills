### Case TASK-GRAPH-CLI-PATH-001: 路径失败返回 exit 1、单个 LF JSON 且 stderr 为空

Tests:
- `test:f3600694876855f568e566464ab796057a157901ea178e998d61dcb7bb629f40`

Tags:
- `task-graph`

Contract:
- 源码 CLI 入口中的路径读取失败仍属于协议内错误，不泄漏原始异常到 stderr 或启动级退出码。

Proves:
- 普通文件 root 返回 exit 1、单个 LF JSON 且 stderr 为空，并保留稳定路径错误 code。
