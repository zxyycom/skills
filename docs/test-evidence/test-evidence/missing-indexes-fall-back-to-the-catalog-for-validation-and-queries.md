### Case TEST-EVIDENCE-MISSING-INDEX-001: 缺失索引时从 catalog 回退
Entry:
- `tools/test-evidence/tests/catalog.test.ts > missing indexes fall back to the catalog for validation and queries`
- `bun test --test-name-pattern="^missing indexes fall back to the catalog for validation and queries$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- 索引缺失时，校验和查询必须读取权威 catalog 并返回非阻断诊断。
Proves:
- 两个 case 仍可查询，`state-index.index-missing` 不阻断读取。
