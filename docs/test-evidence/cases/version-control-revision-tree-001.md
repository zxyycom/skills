### Case VERSION-CONTROL-REVISION-TREE-001: 拒绝不支持的批量 revision tree entry

Tests:
- `test:1386d068824ab187e28883898ada91cacb1b65126bee68168d9b75c19b450bc1`

Tags:
- `version-control`

Contract:
- `readRevisionFiles` 只能返回普通、可执行或符号链接 blob；Gitlink 与其他不能表达为文件字节的 tree entry 必须使读取失败。

Proves:
- 包含 Gitlink 的匹配范围返回带路径上下文的 `operation-failed`，不会静默遗漏该 entry。
