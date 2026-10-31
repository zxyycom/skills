### Case INVESTIGATION-RENAME-TRUE-NOOP-001: 调查same-ID同路径更名真零写

Tests:
- `test:f5e79f856c6f93e45ca7aecf160ab6a8da62bc78c1b44c7ab7a7c4d1edec3c90`

Tags:
- `investigation-report`

Contract:
- 同ID同位置更名只确认必要身份、安全和冲突，不要求无关正文健康或历史更名确认。

Proves:
- Git已记录且所选文本非canonical、mode0640、无关正式正文损坏时仍成功unchanged，字节／inode／mode／索引均不变。
