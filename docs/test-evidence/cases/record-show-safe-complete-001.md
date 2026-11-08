### Case RECORD-SHOW-SAFE-COMPLETE-001: Decision Show 的安全来源与编码边界

Tests:
- `test:876f7605ffddd4b33d5c9ae5808e14c1a2001ccc30ce6d7d730e437f28efe96d`
- `test:ddc6bc32caf655dc4e099bea61603c6cf6a1b4b8cdf8a06cf0ee7a8180daabab`

Tags:
- `decision-records`

Contract:
- Decision show 按选定身份读取正文，拒绝符号链接及非法 UTF-8。

Proves:
- 真实 CLI 对普通文件控制成功；所选文件替换为外部 symlink 或非法 UTF-8 后安全失败，索引与外部内容保持。
