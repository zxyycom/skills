### Case INVESTIGATION-INDEX-INTEGRITY-001: 索引加载拒绝过期与篡改内容
Entry:
- `tools/investigation-report/tests/index-query.test.ts > index loading rejects stale and tampered investigation indexes`
- `bun test --test-name-pattern="^index loading rejects stale and tampered investigation indexes$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查索引加载必须验证源新鲜度和内容完整性。
Proves:
- 过期或篡改索引不会被当作当前可信状态使用。
