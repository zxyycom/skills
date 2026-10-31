### Case INDEX-PREPARED-FULL-001: 全量同步复用构建但独立验最终 revision

Tests:
- `test:030462c9869997ed4dd41b857dfdaa8a239bfa0d3675e8b66cf4ce1e839f2322`

Tags:
- `index-runtime`

Contract:
- full sync 可消费同阶段 native build，不能让 raw sync 信任外来值或省略 fresh。

Proves:
- prepared full sync 不再 parse/构建，raw sync 仍自行构建，最终来源漂移拒绝。
