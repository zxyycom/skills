### Case TEST-EVIDENCE-MIGRATE-PREFLIGHT-001: 迁移预演精确映射 locator 并保留 Case 语义

Tests:
- `test:6874bfa1bf774b4418396b596c5c44cc0d232749c94a1abce536a40b55c44505`

Tags:
- `repository-tooling`

Contract:
- 迁移只接受已验证的旧 Case 与完整快照，并保留 Case ID、标题、Contract、Proves 和 topic 初始 tag。

Proves:
- 预演构造 Case-only 目录和索引，且 tests 只来自精确映射的真实实体。
