### Case TEST-EVIDENCE-SCHEMA-V3-001: Test Evidence 只读取并重建键控 Schema v3

Entry:
- `tools/test-evidence/tests/catalog.test.ts > schema v2 indexes are rejected and rebuilt as keyed schema v3`
- `bun test --test-name-pattern="^schema v2 indexes are rejected and rebuilt as keyed schema v3$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- Test-evidence 派生索引只接受按 case ID 键控的 schema v3；schema v2 由权威目录重建，不保留兼容读取分支。

Proves:
- 领域 Schema 拒绝数组型 schema v2，查询返回稳定版本 warning 并使用内存投影，写同步随后产生合法 schema v3。
