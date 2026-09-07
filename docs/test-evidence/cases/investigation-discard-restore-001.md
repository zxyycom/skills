### Case INVESTIGATION-DISCARD-RESTORE-001: discard restores report resources and index when index publication fails

Tests:
- `test:5c3fb4f21ca8a0e7630ca8dfc995b77c1fbd6c49668113267b1ef2c69041bef4`

Tags:
- `investigation-report`

Contract:
- discard 发布索引失败时必须恢复被 tombstone 的报告、owner 资源和原索引字节。

Proves:
- 模拟索引写失败后结果以 `rolled-back` outcome 和发布诊断 code 表示恢复，报告、资源和索引均恢复。
