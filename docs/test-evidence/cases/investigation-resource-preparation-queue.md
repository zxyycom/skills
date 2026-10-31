### Case INVESTIGATION-RESOURCE-PREPARATION-QUEUE-001: 资源准备阶段使用共同安全读取队列

Tests:
- `test:2ae8c57e93970034c28510dd6f7d9385e8c446013418f0d270c091c4f126bad5`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- 已选资源文件的 prepare 安全采集独立于 fresh；共同读取队列保留原路径顺序、完整二进制 snapshot、可选 mode 约束及首个失败，之后才采集目录身份。

Proves:
- 乱序的两个二进制来源按输入顺序进入 Map，原始字节和 mode 保留；missing 与 mode mismatch 的两种顺序均报告第一个文件，不继续进入故意无效的目录。该小 fixture 验证领域队列接线，不单独证明 worker 阈值或资源移动恢复。
