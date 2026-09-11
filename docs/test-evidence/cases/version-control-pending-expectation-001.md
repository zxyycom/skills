### Case VERSION-CONTROL-PENDING-EXPECTATION-001: 锁内核对期望 Pending 普通文件

Tests:
- `test:93c25d380197401ca394de6820eeddfbef0940ff668574a0394646e772c8b443`

Tags:
- `version-control`

Contract:
- `replacePendingFiles` 传入 `expectedFiles` 时，必须在写入锁内且在任何目标写入前核对范围内普通文件的完整路径、字节和普通文件表示。

Proves:
- 字节不同、可执行文件、符号链接和未解决的同路径内容都返回 `pending-conflict`，其原因保持为不外推的 `unknown`，不会进入 pending 写入 hook。
- 冲突保留受控的 pending 验证 operation 与精确 path scope，目标范围及范围外 pending 内容保持原样。
