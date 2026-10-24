### Case TEST-EVIDENCE-LEDGER-CLI-NODE-SMOKE-001: 分发 TS 的 Node 进程边界保持当前公共 API

Tests:
- `test:b1e01a7911c501a975edad8a983f443526e5bb5b7bec2551ae16521f19381a2c`

Tags:
- `test-evidence`

Contract:
- 真实 Node 进程必须能导入分发 TS，且该进程边界只暴露当前公共 API。

Proves:
- Node 子进程导入后返回恰当的排序导出集合，公共查询、展示、同步、暂存与校验操作均为函数。
