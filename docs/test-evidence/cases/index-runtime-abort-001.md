### Case INDEX-RUNTIME-ABORT-001: 遵守已取消的构建信号

Tests:
- `test:69eee12f7bfb41a1c314b590d95a61e9781df0b8e61eaf660f7695efd92294f5`

Tags:
- `index-runtime`

Contract:
- 构建入口必须在已取消信号下停止并返回稳定诊断。

Proves:
- 预先取消的信号返回 `state-index.operation-aborted`。
