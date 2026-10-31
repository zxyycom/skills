### Case DECISION-FILESYSTEM-INDEX-SOURCE-001: 索引源读取拒绝非普通决策文件

Tests:
- `test:ef24d00188c84e6de5333e6be7d81962a2d8122c97c5fd8d173b1cee62404438`

Tags:
- `decision-records`

Contract:
- 建立索引时，Decision ID 对应的 root 或 archive 源必须是普通非符号链接文件。

Proves:
- 源读取对目录和指向决策目录外文件的符号链接均在读取前失败，对 unsafe source 与外部路径的 readFile 调用计数均为零，外部文件内容保持不变。
