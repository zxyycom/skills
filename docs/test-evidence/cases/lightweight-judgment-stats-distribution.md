### Case LIGHTWEIGHT-JUDGMENT-STATS-DISTRIBUTION-001: 独立 Node 离线统计分发

Tests:
- `test:cb406a4d3c1131f8ca708af1415837125a91a0d961e731ebf476a20040a362c1`

Tags:
- `lightweight-judgment`

Contract:
- 生成 CLI 在独立 Node 工作目录、已有兼容依赖、无配置／密钥下只读当前结构的活跃 WAL；缺库不创建。

Proves:
- 独立 ts 子进程 stats 成功、attempts=0 且读到 WAL 记录，主库字节与版本保持；缺库 storage／退出 4、无 persistence 且文件不存在，help 公布 stats。
