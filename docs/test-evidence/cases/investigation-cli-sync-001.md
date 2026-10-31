### Case INVESTIGATION-CLI-SYNC-001: CLI sync-index writes a missing derived index

Tests:
- `test:30b3c7f35a75867597fb949a3e694f085cd9ee617cd533a24129711edf7f0a18`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `sync-index` 能从合法报告源重建缺失的派生 index。

Proves:
- index 缺失时命令成功、stderr 为空，stdout 报告同步成功，且 index 文件被创建并包含报告 entry。
