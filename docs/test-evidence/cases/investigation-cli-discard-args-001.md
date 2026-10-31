### Case INVESTIGATION-CLI-DISCARD-ARGS-001: CLI discard rejects malformed investigation IDs as argument errors

Tests:
- `test:1f816f4f7028bc188a905be8bb4ca56c34bd1690b8876dcb94e003c20da506d3`

Tags:
- `investigation-report`

Contract:
- CLI 的非法 Investigation ID 是调用参数错误，不是领域操作失败。

Proves:
- 同进程源码 CLI 在空根对 `./report.md` 返回 status 2、空 stdout 和 ID 格式诊断，根目录仍为空。
