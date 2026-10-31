### Case DECISION-FILESYSTEM-QUERY-BODY-001: 查询正文拒绝非普通决策文件

Tests:
- `test:351e3f68402a39a97f57999668e6ae4cd97a16cd4d46452ae3702ac5468ef5c7`

Tags:
- `decision-records`

Contract:
- `show` 读取已索引正文前必须重新确认目标为普通非符号链接文件。

Proves:
- `show` 对目录和指向决策目录外文件的符号链接均返回读取失败，unsafe source 与外部路径的 readFile 调用计数均为零，且外部文件内容保持不变。
