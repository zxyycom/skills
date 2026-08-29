### Case DECISION-TAG-SOURCE-DRIFT-001: Check 检测标签来源漂移并由同步接受

Entry:
- `tools/decision-records/tests/queries.test.ts > check detects tagged source drift and sync-index accepts it`
- `bun test --test-name-pattern="^check detects tagged source drift and sync-index accepts it$" ./tools/decision-records/tests/run.ts`

Contract:
- 标签来源漂移使 strict check 失败；sync-index 重建后接受当前来源。

Proves:
- 添加 tag 后 check 非零，随后同步索引成功。
