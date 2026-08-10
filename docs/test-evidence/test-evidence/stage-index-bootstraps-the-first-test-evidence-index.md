### Case TEST-EVIDENCE-STAGE-BOOTSTRAP-001: 首次暂存建立所选测试证据索引

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index bootstraps the first test evidence index`
- `bun test --test-name-pattern="^stage-index bootstraps the first test evidence index$" ./tools/test-evidence/tests/run.ts`

Contract:
- current revision 尚无测试证据索引时，首次合法 Case 选择使用工作区集合级 metadata 建立 pending 索引。

Proves:
- pending 索引只包含所选 Case 条目并保留完整 topic metadata。
- 首次暂存不连带加入 topic 表或 Case Markdown。
- 分发模块导出的程序化入口与维护源码共享该行为。
