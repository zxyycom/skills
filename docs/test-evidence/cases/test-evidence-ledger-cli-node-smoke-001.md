### Case TEST-EVIDENCE-LEDGER-CLI-NODE-SMOKE-001: 分发 MJS 的 Node 进程边界保持当前公共 API

Tests:
- `test:d22903f31266339254cba7a15f2b6b7498ddabb9ad55748c2a593eacb883a89a`

Tags:
- `test-evidence`

Contract:
- 真实 Node 进程必须能导入分发 MJS，且该进程边界只暴露当前公共 API。

Proves:
- Node 子进程导入后返回恰当的排序导出集合，公共查询、展示、同步、暂存与校验操作均为函数。
