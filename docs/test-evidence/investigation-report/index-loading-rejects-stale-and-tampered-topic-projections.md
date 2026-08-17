### Case INVESTIGATION-INDEX-INTEGRITY-001: 索引加载拒绝过期与篡改的主题投影

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index loading rejects stale and tampered topic projections`
- `bun test --test-name-pattern="^index loading rejects stale and tampered topic projections$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查索引加载必须用当前主题 Markdown 的 source revision 拒绝过期索引，并在完整校验时拒绝不符合运行时 key projection 的持久化 state。

Proves:
- 直接新增主题文件后，完整验证和查询都拒绝未同步索引。
- 同步后篡改索引标题，完整验证拒绝其 state 与运行时 keys 不一致。
