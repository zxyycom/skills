### Case TEST-EVIDENCE-MIGRATE-DIAGNOSTICS-001: 迁移汇总所有未映射旧 Entry

Tests:
- `test:8de0f515ec1012dfde8d3709d73b31265521c243d83eadef33a746edf21f758d`

Tags:
- `repository-tooling`

Contract:
- 迁移预演必须在拒绝前报告全部无法唯一映射的旧 Entry，不能只报告首个失败。

Proves:
- 空快照时，单个旧 Case 的所有 Entry 都出现在稳定的阻断诊断中。
