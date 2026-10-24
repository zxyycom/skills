### Case INVESTIGATION-DISCARD-RESTORE-001: discard restores report resources and index when index publication fails

Tests:
- `test:cbeb3bff8192be8222e78927d6c94b299b87b205b104f917ce8eca6d77e0be3d`

Tags:
- `investigation-report`

Contract:
- discard 发布索引失败时必须恢复被 tombstone 的报告、owner 资源和原索引字节。

Proves:
- 模拟索引写失败后结果以 `rolled-back` outcome 和发布诊断 code 表示恢复，报告、资源和索引均恢复。
