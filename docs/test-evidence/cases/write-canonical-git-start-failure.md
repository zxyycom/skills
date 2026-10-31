### Case WRITE-CANONICAL-CASE-001: Git 启动失败保持 pending

Tests:
- `test:be96d3ed4cb5fec30216be0097cc2ce43ccbed013307ef1a4d9b2eba0e0a7410`

Tags:
- `write-canonical`

Contract:
- Git 子进程未能启动时不得发布替换，锁须恢复。

Proves:
- 模拟写对象时启动失败并核对 index 原字节和锁清理。
