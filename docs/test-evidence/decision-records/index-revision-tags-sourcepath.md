### Case DECISION-INDEX-REVISION-001: 索引 revision 跟踪标签和 sourcePath

Entry:
- `tools/decision-records/tests/layout-index.test.ts > index revision detects tag and sourcePath changes before accepting a rebuilt snapshot`
- `bun test --test-name-pattern="^index revision detects tag and sourcePath changes before accepting a rebuilt snapshot$" ./tools/decision-records/tests/run.ts`

Contract:
- 标签或 sourcePath 变化必须使持久索引 revision 失效；只有重建后才接受新快照。

Proves:
- 改 tags 后严格验证失败；sync-index 后索引含排序后的新 tags。
