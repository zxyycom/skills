### Case TEST-EVIDENCE-LEDGER-ENTITY-SCHEMA-001: 实体索引拒绝不兼容结构与身份
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > entity indexes reject invalid schemas ordering identities and locators`
- `bun test --test-name-pattern="^entity indexes reject invalid schemas ordering identities and locators$" ./tools/test-evidence/tests/run.ts`
Contract:
- 实体索引必须严格校验 UTF-8、版本、未知字段、排序、唯一性、Test ID 与 locator。
Proves:
- 每类不兼容结构或损坏编码都不能形成实体权威来源或派生索引，并产生实体索引诊断。
