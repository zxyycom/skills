### Case TEST-EVIDENCE-MIGRATE-PREFLIGHT-001: 迁移预演精确映射 locator 并保留 Case 语义

Tests:
- `test:736e5e8c64b862662648128c4f842cd7e3fd3eddd11518c94b4d671df20f58ec`

Tags:
- `repository-tooling`

Contract:
- 迁移只接受已验证的旧 Case 与完整快照，并保留 Case ID、标题、Contract、Proves 和 topic 初始 tag。

Proves:
- 预演构造 Case-only 目录和索引，且 tests 只来自精确映射的真实实体。
