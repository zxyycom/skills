### Case TEST-EVIDENCE-LEDGER-SCHEMA-STRICT-001: Ledger Schema 严格拒绝未知字段与旧定义
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > ledger schemas reject unknown fields and incompatible versions`
- `bun test --test-name-pattern="^ledger schemas reject unknown fields and incompatible versions$" ./tools/test-evidence/tests/run.ts`
Contract:
- Ledger 内部 API options、机器结果与持久索引必须采用严格 Schema，并拒绝不可能的版本、同步状态或 Case 展示字段组合。
Proves:
- 五个仓库内部 API 的未知 option、互相矛盾的 `status/state/changed/mode`、失败展示中的非空 Markdown 及旧 `definitionVersion` 都无法通过各自 Schema。
