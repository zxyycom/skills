### Case INVESTIGATION-RENAME-OWNER-CONTENT-001: 恢复前 target owner 内容漂移保留外部字节

Tests:
- `test:e342f82515bcbd24b44c8dd352cb65d85013a2a34ac5acb9fa926bd9b87c6380`

Tags:
- `investigation-report`

Contract:
- rename 对 owner tree 的预演必须包含目录/文件类型、权限、文件大小和内容摘要。索引发布失败后的恢复先证明 target owner 仍等于本事务复制的快照；任何同名文件内容漂移都不得回拷、删除或报告完整 rollback。

Proves:
- index writer 在资源迁移后改写 target 同名文件并失败时，结果是 `partial-or-unknown`。
- 外部替换字节保留，旧 owner 不被伪造恢复，report/index 的独立恢复仍完成。
