### Case DECISION-BATCH-FRESH-001: 来源阶段变化不复用旧身份定位

Tests:
- `test:a6282d8bd38d3b7b3eb938fd3b6fe0f66b211b158b6bbef4559f44aad1f39987`

Tags:
- `source-validation`

Contract:
- lookup 只属于当前来源阶段，不能代替后续 fresh 扫描。

Proves:
- 所选 Markdown ID 在两个扫描之间改变后，新 lookup 不再定位旧身份，新准备失败，旧 lookup 的存在不掩盖变化。
