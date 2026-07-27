### Case INDEX-RUNTIME-TEXT-SEARCH-001: 跨调查与测试证据状态搜索文本键
Entry:
- `tools/index-runtime/tests/query.test.ts > searches text keys across investigation and test-evidence states`
- `bun test --test-name-pattern="^searches text keys across investigation and test-evidence states$" ./tools/index-runtime/tests/run.ts`
Contract:
- 文本索引必须对不同领域状态执行一致的全词项匹配。
Proves:
- 中英文词项分别命中预期调查和测试证据状态。
