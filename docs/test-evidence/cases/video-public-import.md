### Case VIDEO-PUBLIC-IMPORT-001: 公开导入保持窄 API 与无副作用

Tests:
- `test:73c938bc8d3fb4c50f6e635d295aba9d71a6dd9b5b1a392a4cbbcbc1d758e4b6`

Tags:
- `video-understanding`

Contract:
- 普通导入只公开 runVideoCli 和 VideoFailure，不能执行 argv、读取位置配置、启动进程/网络或改变退出状态。

Proves:
- 真实 Node 导入导出名精确匹配；损坏配置不影响导入，被拦截的进程/网络入口未调用，退出状态与文件快照保持不变。
