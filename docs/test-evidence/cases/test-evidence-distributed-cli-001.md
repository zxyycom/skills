### Case TEST-EVIDENCE-DISTRIBUTED-CLI-001: 分发 TS 在 Node 中仅暴露当前公共 API

Tests:
- `test:b1e01a7911c501a975edad8a983f443526e5bb5b7bec2551ae16521f19381a2c`

Tags:
- `test-evidence`

Contract:
- 分发 TS 可在支持的 Node 中导入，不运行 CLI 输出且仅导出当前公开 API。

Proves:
- 真实 Node 动态导入成功并且 stdout/stderr 保持预期无 CLI 输出，导出键恰为当前公共集合，公开操作均为函数；不声明任意全局零副作用。
