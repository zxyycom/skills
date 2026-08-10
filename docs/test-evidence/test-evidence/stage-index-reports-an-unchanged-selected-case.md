### Case TEST-EVIDENCE-STAGE-UNCHANGED-001: 无变化选择返回 Unchanged 且不制造 Pending

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index reports an unchanged selected case`
- `bun test --test-name-pattern="^stage-index reports an unchanged selected case$" ./tools/test-evidence/tests/run.ts`

Contract:
- 所选 Case 与 revision 完全一致且同索引 pending 干净时，命令返回合法无变化结果。

Proves:
- 结果为 `ok + unchanged + changed: false`。
- 版本仓库不会新增待提交路径。
