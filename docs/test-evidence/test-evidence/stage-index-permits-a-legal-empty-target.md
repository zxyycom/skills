### Case TEST-EVIDENCE-STAGE-EMPTY-001: 删除最后一个 Case 可形成合法空目标

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index permits a legal empty target`
- `bun test --test-name-pattern="^stage-index permits a legal empty target$" ./tools/test-evidence/tests/run.ts`

Contract:
- 选中删除 revision 中最后一个 Case 时，完整 topic metadata 与空 entries 可以形成合法目标索引。

Proves:
- 暂存成功并在 pending 索引中产生空 entries record。
