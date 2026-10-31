### Case INVESTIGATION-STAGE-SYMLINK-SOURCE-001: 选中 owner 的符号链接来源阻断暂存

Tests:
- `test:1b186d4b46a1c822e62f03a8f6fbae83f1b5159c421c3a067e49deecbb41731e`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 选中 owner 的资源来源须为常规非符号链接文件；完整树安全校验在读取资源字节前拒绝符号链接。

Proves:
- 真实 owner 树中的未引用符号链接被拒绝，资源字节读取计数为零，原脚本字节不变。
- 该校验错误经领域失败映射后保留 `investigation-report.stage-source-read-failed` 诊断与 `domain-stage-failed` 状态。
