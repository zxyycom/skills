### Case INDEX-PREPARED-FULL-001: 全量同步复用构建但独立验最终 revision

Tests:
- `test:63393301f5b762a3e32f9e1ffea20b8f13b8d2b27b8339b10d01a3d9666e8990`

Tags:
- `index-runtime`

Contract:
- full sync 可消费同阶段 native build，不能让 raw sync 信任外来值或省略 fresh。

Proves:
- prepared full sync 不再 parse/构建，raw sync 仍自行构建，最终来源漂移拒绝。
