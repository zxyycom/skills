### Case INVESTIGATION-CLI-DISCARD-ARGS-001: CLI discard rejects malformed investigation IDs as argument errors

Tests:
- `test:f7c8b35350bdd32d081381e1760a02a2f23da0f0279bc1e804abf58fb08209df`

Tags:
- `investigation-report`

Contract:
- CLI 的非法 Investigation ID 是调用参数错误，不是领域操作失败。

Proves:
- 同进程源码 CLI 在空根对 `./report.md` 返回 status 2、空 stdout 和 ID 格式诊断，根目录仍为空。
