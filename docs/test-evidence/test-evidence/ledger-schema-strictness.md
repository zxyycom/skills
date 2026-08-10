### Case TEST-EVIDENCE-LEDGER-SCHEMA-STRICT-001: Ledger Schema 严格拒绝未知字段与旧定义
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > ledger schemas reject unknown fields and incompatible versions`
- `bun test --test-name-pattern="^ledger schemas reject unknown fields and incompatible versions$" ./tools/test-evidence/tests/run.ts`
Contract:
- Ledger API options 与持久索引必须采用严格 Schema 和固定版本组合。
Proves:
- 五个公共 API 的未知 option 与旧 definitionVersion 都无法通过对应 Schema。
