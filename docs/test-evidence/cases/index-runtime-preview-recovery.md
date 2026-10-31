### Case INDEX-RUNTIME-PREVIEW-RECOVERY-001: 完整同步预演允许恢复索引且不落盘

Tests:
- `test:fe0e80d3ac8998e82001c85611939046fcfaab472f11b246ca0eaa126c5e8580`

Tags:
- `index-runtime`

Contract:
- 全量 preview 执行正式同步的准备与来源漂移保护，但不创建目录或改写索引；check 仍严格验证 currentness。

Proves:
- 缺失索引预演成功且不创建父目录；损坏 JSON、非法 UTF-8、旧 schema 和 stale 索引预演后字节与 mtime 不变。
- 严格 check 对缺失、坏索引与 stale 失败；正式 write 才发布规范索引，current 预演明确 unchanged。
