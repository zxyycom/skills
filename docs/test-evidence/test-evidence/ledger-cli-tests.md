### Case TEST-EVIDENCE-LEDGER-CLI-TESTS-001: Tests CLI 暴露实体搜索与反向 Case 关系
Entry:
- `tools/test-evidence/tests/ledger-cli.test.ts > ledger CLI tests searches authority and exposes derived reverse memberships`
- `bun test --test-name-pattern="^ledger CLI tests searches authority and exposes derived reverse memberships$" ./tools/test-evidence/tests/run.ts`
Contract:
- `tests` 必须按实体权威字段搜索，并输出运行时派生的 Case memberships。
Proves:
- Gamma 搜索只返回目标 Test 及其两个有序 Case ID。
