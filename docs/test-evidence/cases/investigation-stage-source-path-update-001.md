### Case INVESTIGATION-STAGE-SOURCE-PATH-UPDATE-001: 暂存索引指向的报告而非同 ID 文件名下的其他报告

Tests:
- `test:6e280b14b5cfea75c9eab10d48e01490b0ba6bab8aba0d92ba2461a1972efa70`

Tags:
- `investigation-report`

Contract:
- domain 按工作区索引 sourcePath 选择报告，不以看似同 ID 的文件名覆盖其他报告。

Proves:
- 真实 Git 中 alpha 使用 semantic-name.md；名称为 alpha 的文件实际属于 beta，beta 的 HEAD、pending 与工作区各自保持，pending 索引不变。
