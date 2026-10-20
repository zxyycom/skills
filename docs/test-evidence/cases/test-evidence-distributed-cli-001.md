### Case TEST-EVIDENCE-DISTRIBUTED-CLI-001: 分发 TS 在 Node 中仅暴露当前公共 API

Tests:
- `test:51b392c2f95b0c5d2ac92fe8e12ff4ce047023212c58da5394a8f99f0650c1ad`

Tags:
- `test-evidence`

Contract:
- 分发的 TS 模块必须可由 Node 无副作用导入，并且只导出当前定义的公共 API。

Proves:
- Node 动态导入成功，导出键恰为当前公共集合；全部公开操作函数均可调用。
