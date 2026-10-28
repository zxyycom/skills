### Case WRITE-CANONICAL-CASE-001: Git 启动失败保持 pending

Tests:
- `test:df56e3952e77db00d3b79f987560fdb0e5a405950cf780782cd12e9b7fdfeec4`

Tags:
- `write-canonical`

Contract:
- Git 子进程未能启动时不得发布替换，锁须恢复。

Proves:
- 模拟写对象时启动失败并核对 index 原字节和锁清理。
