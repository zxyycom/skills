### Case INVESTIGATION-DISCARD-RESTORE-001: discard restores report resources and index when index publication fails

Entry:
- `tools/investigation-report/tests/discard.test.ts > discard restores report resources and index when index publication fails`
- `bun test --test-name-pattern="^discard restores report resources and index when index publication fails$" ./tools/investigation-report/tests/run.ts`

Contract:
- discard 发布索引失败时必须恢复被 tombstone 的报告、owner 资源和原索引字节。

Proves:
- 模拟索引写失败后结果以 `rolled-back` outcome 和发布诊断 code 表示恢复，报告、资源和索引均恢复。
