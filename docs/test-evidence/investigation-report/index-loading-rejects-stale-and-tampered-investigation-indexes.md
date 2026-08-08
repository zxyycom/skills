### Case INVESTIGATION-INDEX-INTEGRITY-001: 索引加载拒绝过期与篡改内容
Entry:
- `tools/investigation-report/tests/index-query.test.ts > index loading rejects stale and tampered investigation indexes`
- `bun test --test-name-pattern="^index loading rejects stale and tampered investigation indexes$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查索引快速加载必须验证通用结构、schema 版本与结构化来源新鲜度；显式完整解析继续验证 ID-keyed state 和领域内容完整性。
Proves:
- 过期索引在快速加载时被拒绝，key projection 篡改在严格检查时被拒绝。
- Schema v2、非法来源 fingerprint、state/path 身份不一致和报告计数篡改均被完整解析拒绝。
