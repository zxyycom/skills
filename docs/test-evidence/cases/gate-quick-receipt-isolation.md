### Case GATE-QUICK-RECEIPT-ISOLATION-001: quick 沿用精确复用但不发布或清理完整证明

Tests:
- `test:2a1030bfa128cae46fba05fbf5dfc87bf52f31acf9fcea0661d44ea6eae34d49`

Tags:
- `repository-tooling`

Contract:
- 默认 quick 仍使用原有精确激活计划与工具 flags，但不调用完整验收 receipt 发布器，也不清理既有证明；公开摘要不能把范围外计划伪称为本轮执行。

Proves:
- 默认调用向 Definition 传入 quick 与原样空 activeToolIds，执行 controls 保持空 flags；注入的发布器从未调用，旧 receipt 字节保持不变。
- 同时含 markdown-lint 复用与重型 Check 执行的计划只在 quick decisions 投影保留前者；摘要分别给出 9 项执行、1 项复用、57 项禁用，完整两项计划另存，并公开 quick-scope 未发布原因。
