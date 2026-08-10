### Case TEST-EVIDENCE-LEDGER-ENTITY-FINGERPRINT-001: 实体索引指纹只跟踪规范化语义
Entry:
- `tools/test-evidence/tests/ledger-source.test.ts > entity indexes parse canonical empty and populated sources with stable fingerprints`
- `bun test --test-name-pattern="^entity indexes parse canonical empty and populated sources with stable fingerprints$" ./tools/test-evidence/tests/run.ts`
Contract:
- 实体索引必须接受空集与有序实体集，并从规范化内容生成稳定指纹。
Proves:
- JSON 字段排版变化不改变指纹；来源版本变化会改变指纹，项目复用版本时实体名称或 locator 变化也会改变指纹。
