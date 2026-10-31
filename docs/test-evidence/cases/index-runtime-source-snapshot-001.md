### Case INDEX-RUNTIME-SOURCE-SNAPSHOT-001: 报告畸形源快照

Tests:
- `test:4d3d5b1e410d397b0b278e91af02259fc2aec341b7bb39e1b101d47b276d7971`

Tags:
- `index-runtime`

Contract:
- 定义的读取器必须返回结构完整的源快照。

Proves:
- 返回 null 的读取器使构建返回 value=null 与 `state-index.source-invalid`。
