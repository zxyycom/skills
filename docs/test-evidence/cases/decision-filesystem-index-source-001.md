### Case DECISION-FILESYSTEM-INDEX-SOURCE-001: 索引源读取拒绝非普通决策文件

Tests:
- `test:7986def22857af86615fc256ef8b69c2379bd96ddd8ff3b736a9dad8c9196749`

Tags:
- `decision-records`

Contract:
- 建立索引时，Decision ID 对应的 root 或 archive 源必须是普通非符号链接文件。

Proves:
- 源读取对目录和指向决策目录外文件的符号链接均在读取前失败，外部文件内容保持不变。
