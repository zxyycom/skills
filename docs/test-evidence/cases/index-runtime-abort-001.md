### Case INDEX-RUNTIME-ABORT-001: 遵守已取消的构建信号

Tests:
- `test:5e90930ec533c26c9984dc4ab56913ad4ab90ce4644aef98f9b557880b72a0d3`

Tags:
- `index-runtime`

Contract:
- 构建入口必须在已取消信号下停止并返回稳定诊断。

Proves:
- 预先取消的信号返回 `state-index.operation-aborted`。
