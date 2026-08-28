### Case INVESTIGATION-STAGE-RESOURCE-ADD-001: stage-index treats unrelated report resources as outside selected report entries

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index treats unrelated report resources as outside selected report entries`
- `bun test --test-name-pattern="^stage-index treats unrelated report resources as outside selected report entries$" ./tools/investigation-report/tests/run.ts`

Contract:
- 未选报告的资源变化不自动进入已选报告 index entry。

Proves:
- 真实 Git fixture 只选择 first report 时，second 的资源改动不进入 pending index，也不扩大 selected IDs。
