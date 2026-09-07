### Case TEST-EVIDENCE-DISTRIBUTED-CLI-001: 分发 MJS 在 Node 中仅暴露当前公共 API

Tests:
- `test:d22903f31266339254cba7a15f2b6b7498ddabb9ad55748c2a593eacb883a89a`

Tags:
- `test-evidence`

Contract:
- 分发的 MJS 模块必须可由 Node 无副作用导入，并且只导出当前定义的公共 API。

Proves:
- Node 动态导入成功，导出键恰为当前公共集合；全部公开操作函数均可调用。
