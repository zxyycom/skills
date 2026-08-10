### Case TEST-EVIDENCE-LEDGER-RELATION-GATE-001: 关系门禁拒绝悬空重复与空端点
Entry:
- `tools/test-evidence/tests/ledger-relations.test.ts > ledger relation gates reject empty duplicate unknown and unreferenced endpoints`
- `bun test --test-name-pattern="^ledger relation gates reject empty duplicate unknown and unreferenced endpoints$" ./tools/test-evidence/tests/run.ts`
Contract:
- 非空 Ledger 的每个 Case 与 Test 都必须参与已知、唯一且非空的关系。
Proves:
- 未引用 Test、未知 Test、重复 Test 和空 Tests 段都会阻止关系闭合。
