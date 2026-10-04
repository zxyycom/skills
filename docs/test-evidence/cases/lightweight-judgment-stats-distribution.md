### Case LIGHTWEIGHT-JUDGMENT-STATS-DISTRIBUTION-001: 独立 Node 离线统计分发

Tests:
- `test:3fab27ac9c28a973f3979059e3f0a7f4f68dcdbd47ba9e7d486bf060bf649c9a`

Tags:
- `lightweight-judgment`

Contract:
- 生成 CLI 在独立 Node 工作目录、无配置／密钥／工作区依赖下只读已有 v1 活跃 WAL；缺库不创建。

Proves:
- 独立 mjs 子进程 stats成功、attempts0且读到WAL记录，主库字节/version保持；缺库storage4无persistence且文件不存在，help公布stats。
