### Case DECISION-FILESYSTEM-INDEX-SOURCE-001: 索引维护拒绝符号链接来源

Tests:
- `test:ddc6bc32caf655dc4e099bea61603c6cf6a1b4b8cdf8a06cf0ee7a8180daabab`

Tags:
- `decision-records`

Contract:
- full sync 读取的正式正文须为安全普通文件。

Proves:
- 真实 CLI 对普通文件 full sync 成功；换成外部 symlink 后安全失败，索引及外部文件字节保持。
