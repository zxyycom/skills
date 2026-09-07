### Case DECISION-FILESYSTEM-INDEX-SOURCE-001: 索引源读取拒绝非普通决策文件

Tests:
- `test:cdb9ff634183449f51a0494e4fd548342e790d29401b218f3e9762a7916b9106`

Tags:
- `decision-records`

Contract:
- 建立索引时，Decision ID 对应的 root 或 archive 源必须是普通非符号链接文件。

Proves:
- 源读取对目录和指向决策目录外文件的符号链接均在读取前失败，外部文件内容保持不变。
