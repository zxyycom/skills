### Case DECISION-FILESYSTEM-QUERY-BODY-001: 查询正文拒绝非普通决策文件

Tests:
- `test:eb7dcdc9e103a4da79d6ded566c03c3bc658c4c7a73957f8f95e8266e0c76ada`

Tags:
- `decision-records`

Contract:
- `show` 读取已索引正文前必须重新确认目标为普通非符号链接文件。

Proves:
- `show` 对目录和指向决策目录外文件的符号链接均返回读取失败，且外部文件内容保持不变。
