### Case VERSION-CONTROL-REVISION-TREE-001: 拒绝不支持的批量 revision tree entry

Tests:
- `test:3f5023a72ae4b53874735545e2647845ab73459ab0005c5f47d86eb54da4c86f`

Tags:
- `version-control`

Contract:
- `readRevisionFiles` 只能返回普通、可执行或符号链接 blob；Gitlink 与其他不能表达为文件字节的 tree entry 必须使读取失败。

Proves:
- 包含 Gitlink 的匹配范围返回带路径上下文的 `operation-failed`，不会静默遗漏该 entry。
