### Case TEST-EVIDENCE-LEDGER-CLI-LIST-001: List CLI 组合筛选分页并区分未知 Test
Entry:
- `tools/test-evidence/tests/ledger-cli.test.ts > ledger CLI list composes filters pagination JSON and unknown-Test exits`
- `bun test --test-name-pattern="^ledger CLI list composes filters pagination JSON and unknown-Test exits$" ./tools/test-evidence/tests/run.ts`
Contract:
- `list` 必须把 Test、Tag、query 与分页参数传入统一查询契约，并保留领域退出码。
Proves:
- 组合条件返回唯一 Case，未知 Test 输出 JSON 诊断并使用退出码 2。
