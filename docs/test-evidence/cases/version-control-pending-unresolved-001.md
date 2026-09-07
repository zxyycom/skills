### Case VERSION-CONTROL-PENDING-UNRESOLVED-001: 未设期望的未解决 Pending 替换映射为替换失败

Tests:
- `test:533d5f1d6349dfb791e0b4912a2f75a905cdb5014e414b1bb9ffdea1b6f84b27`

Tags:
- `version-control`

Contract:
- 未传入 `expectedFiles` 时，无法读取唯一普通文件内容的 pending 范围属于替换失败，而不是期望冲突。

Proves:
- 含未解决内容的无期望替换返回 `pending-replacement-failed`。
- 原有未解决 pending 表示保持不变。
