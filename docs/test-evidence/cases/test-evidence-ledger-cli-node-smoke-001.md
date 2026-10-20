### Case TEST-EVIDENCE-LEDGER-CLI-NODE-SMOKE-001: 分发 TS 的 Node 进程边界保持当前公共 API

Tests:
- `test:51b392c2f95b0c5d2ac92fe8e12ff4ce047023212c58da5394a8f99f0650c1ad`

Tags:
- `test-evidence`

Contract:
- 真实 Node 进程必须能导入分发 TS，且该进程边界只暴露当前公共 API。

Proves:
- Node 子进程导入后返回恰当的排序导出集合，公共查询、展示、同步、暂存与校验操作均为函数。
