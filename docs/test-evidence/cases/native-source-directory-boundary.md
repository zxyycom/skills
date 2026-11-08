### Case NATIVE-SOURCE-DIRECTORY-BOUNDARY-001: 目录边界不枚举未选成员

Tests:
- `test:64288e2a689498146f889e503c6675d0928d7031bd4ae057dd7797f78fa55203`

Tags:
- `record-rust`

Contract:
- 仅核验目录自身类型时，不应因未选成员名称无法解码而扩大读取范围。

Proves:
- Unix 临时目录包含非 UTF-8 名称时目录边界检查仍成功；不存在的目录报告缺失。该节点不证明并发路径替换安全。
