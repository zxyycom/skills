### Case LIGHTWEIGHT-JUDGMENT-STATS-DISTRIBUTION-001: 独立 Node 离线统计分发

Tests:
- `test:166d4c01cf894e1f880d2966ae39e203ff02b9545c3af5f02266fc95046922f1`

Tags:
- `lightweight-judgment`

Contract:
- 生成 CLI 在独立 Node 工作目录、无配置／密钥／工作区依赖下只读当前结构的活跃 WAL；缺库不创建。

Proves:
- 独立 mjs 子进程 stats 成功、attempts=0 且读到 WAL 记录，主库字节与版本保持；缺库 storage／退出 4、无 persistence 且文件不存在，help 公布 stats。
