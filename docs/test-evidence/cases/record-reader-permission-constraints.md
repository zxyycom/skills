### Case RECORD-READER-PERMISSIONS-001: Node权限模型不因批量读取而放宽

Tests:
- `test:8e7104d047378e4049bc3542a305bb34d07ddf4b9192d9eb24cb1abaf68377e6`

Tags:
- `record-operations`

Contract:
- Node权限模型启用时，大批量安全读取须预先留在当前进程执行，不能创建未继承权限模型的worker。

Proves:
- 真实Node在>=1000项读取中保留ERR_ACCESS_DENIED及FileSystemRead诊断，无论是否授予allow-worker都不创建worker。
