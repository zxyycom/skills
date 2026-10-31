### Case INDEX-RUNTIME-ABORT-001: 遵守已取消的构建信号

Tests:
- `test:0eddd2cdf086838a55a7fe11a1dda94507bac8f9c2b8491c02e4b4d37e2752d5`

Tags:
- `index-runtime`

Contract:
- 构建入口必须在已取消信号下停止并返回稳定诊断。

Proves:
- 预先取消的信号返回 `state-index.operation-aborted`。
