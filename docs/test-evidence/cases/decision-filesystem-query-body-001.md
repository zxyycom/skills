### Case DECISION-FILESYSTEM-QUERY-BODY-001: 查询正文拒绝非普通决策文件

Tests:
- `test:54faedfc4c394194508a3e3c76007849619b3f95971fae06f864d370363afdb7`

Tags:
- `decision-records`

Contract:
- `show` 读取已索引正文前必须重新确认目标为普通非符号链接文件。

Proves:
- `show` 对目录和指向决策目录外文件的符号链接均返回读取失败，且外部文件内容保持不变。
