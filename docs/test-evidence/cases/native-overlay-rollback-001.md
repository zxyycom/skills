### Case NATIVE-OVERLAY-ROLLBACK-001: 原生覆盖普通失败恢复

Tests:
- `test:f2668105ccac3e7da34d33c65e3450b89b8f2932b9e5c1182fb5b73f8e8465bf`

Tags:
- `repository-tooling`

Contract:
- 失败须恢复本次覆盖并移除新增文件。

Proves:
- 注入校验失败后，先前覆盖的普通文件恢复原字节与权限，新增程序被移除；入口仍为原值。
