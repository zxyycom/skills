### Case TEST-EVIDENCE-LEDGER-RELATION-SHAPES-001: 关系图支持全部封闭基数形态
Entry:
- `tools/test-evidence/tests/ledger-relations.test.ts > ledger relation graphs close empty one-to-many many-to-one and many-to-many fixtures`
- `bun test --test-name-pattern="^ledger relation graphs close empty one-to-many many-to-one and many-to-many fixtures$" ./tools/test-evidence/tests/run.ts`
Contract:
- Ledger 必须支持双空、单 Case 多 Test、单 Test 多 Case 与真正多对多关系。
Proves:
- 四种关系形态都按边数闭合，反向 Test→Cases 投影保持有序完整。
